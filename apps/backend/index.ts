import express, { Request, Response } from "express";
import { Dropbox } from "dropbox";
import { Client } from "@elastic/elasticsearch";
import cors from "cors";
import dotenv from "dotenv";
import { Buffer } from "buffer";
import { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

interface DropboxTokens {
	access_token: string;
	refresh_token: string;
	expires_at: number;
}

let dropboxTokens: DropboxTokens | null = null;

async function getDropboxClient(): Promise<Dropbox> {
	if (
		!process.env.DROPBOX_APP_KEY ||
		!process.env.DROPBOX_APP_SECRET ||
		!process.env.DROPBOX_REFRESH_TOKEN
	) {
		throw new Error("Missing Dropbox credentials in environment variables");
	}

	if (!dropboxTokens || Date.now() >= dropboxTokens.expires_at) {
		try {
			const response = await fetch(
				"https://api.dropbox.com/oauth2/token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						grant_type: "refresh_token",
						refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
						client_id: process.env.DROPBOX_APP_KEY,
						client_secret: process.env.DROPBOX_APP_SECRET,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to refresh token: ${response.statusText}`
				);
			}

			const data = await response.json();

			dropboxTokens = {
				access_token: data.access_token,
				refresh_token:
					data.refresh_token || process.env.DROPBOX_REFRESH_TOKEN,
				expires_at: Date.now() + data.expires_in * 1000,
			};

			console.log("Successfully refreshed Dropbox access token");
		} catch (error) {
			console.error("Error refreshing Dropbox token:", error);
			throw error;
		}
	}

	return new Dropbox({
		accessToken: dropboxTokens.access_token,
	});
}

const esClient = new Client({
	node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
});

interface SearchResult {
	filename: string;
	url: string;
	lastModified: string;
	score: number;
	excerpt?: string;
}

interface FileDocument {
	filename: string;
	content: string;
	path: string;
	lastModified: string;
	url: string;
}

interface SearchQueryParams {
	q?: string;
}

async function initializeIndex() {
	const indexName = "dropbox_files";

	try {
		const indexExists = await esClient.indices.exists({ index: indexName });

		if (!indexExists) {
			await esClient.indices.create({
				index: indexName,
				body: {
					mappings: {
						properties: {
							filename: { type: "keyword" },
							content: { type: "text", analyzer: "standard" },
							path: { type: "keyword" },
							lastModified: { type: "date" },
							url: { type: "keyword" },
						},
					},
				},
			});
		}
	} catch (error) {
		console.error("Error creating index:", error);
		throw error;
	}
}

async function indexDropboxFiles() {
	const indexName = "dropbox_files";

	try {
		const dbx = await getDropboxClient();
		const listResult = await dbx.filesListFolder({
			path: "",
			recursive: true,
		});

		const textFiles = listResult.result.entries.filter((entry) =>
			entry.name.endsWith(".txt")
		);

		console.log(`Found ${textFiles.length} text files to index`);

		for (const file of textFiles) {
			try {
				const dbx = await getDropboxClient();

				let directLink: string;
				try {
					const existingSharedLinks =
						await dbx.sharingListSharedLinks({
							path: file.path_lower as string,
						});

					if (existingSharedLinks.result.links.length > 0) {
						directLink = existingSharedLinks.result.links[0].url
							.replace(
								"www.dropbox.com",
								"dl.dropboxusercontent.com"
							)
							.replace("?dl=0", "");
					} else {
						const shareLink = await dbx.sharingCreateSharedLink({
							path: file.path_lower as string,
						});
						directLink = shareLink.result.url
							.replace(
								"www.dropbox.com",
								"dl.dropboxusercontent.com"
							)
							.replace("?dl=0", "");
					}
				} catch (sharingError) {
					directLink = `temporary-link-for-${file.name}`;
					console.warn(
						`Could not create shared link for ${file.name}, using temporary link`
					);
				}

				const fileDownload = await dbx.filesDownload({
					path: file.path_lower as string,
				});

				const fileData = fileDownload.result as any;
				const content = fileData.fileBinary.toString("utf-8");

				await esClient.index({
					index: indexName,
					id: Buffer.from(file.path_lower as string).toString(
						"base64"
					),
					body: {
						filename: file.name,
						content: content,
						path: file.path_lower,
						lastModified: (file as any).server_modified,
						url: directLink,
					},
					refresh: true,
				});

				console.log(`Indexed file: ${file.name}`);
			} catch (fileError) {
				console.error(`Error processing file ${file.name}:`, fileError);
				continue;
			}
		}
	} catch (error) {
		console.error("Error indexing files:", error);
		throw error;
	}
}

app.get(
	"/api/search",
	(req: Request<{}, {}, {}, SearchQueryParams>, res: Response): void => {
		(async () => {
			try {
				const { q: searchTerm } = req.query;

				if (!searchTerm) {
					res.status(400).json({ error: "Search term is required" });
					return;
				}

				const baseQuery: QueryDslQueryContainer = {
					bool: {
						must: [
							{
								multi_match: {
									query: searchTerm,
									fields: ["content", "filename"],
								},
							},
						],
					},
				};

				const result = await esClient.search<FileDocument>({
					index: "dropbox_files",
					body: {
						query: baseQuery,
						highlight: {
							fields: {
								content: {},
							},
						},
					},
				});

				const results: SearchResult[] = result.hits.hits.map((hit) => ({
					filename: hit._source?.filename ?? "",
					url: hit._source?.url ?? "",
					lastModified: hit._source?.lastModified ?? "",
					score: hit._score ?? 0,
					excerpt: hit.highlight?.content
						? hit.highlight.content[0]
						: undefined,
				}));

				res.json(results);
			} catch (error) {
				console.error("Search error:", error);
				res.status(500).json({ error: "Search failed" });
			}
		})();
	}
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
	try {
		await getDropboxClient();
		await initializeIndex();
		await indexDropboxFiles();
		console.log(`Server running on port ${PORT}`);
	} catch (error) {
		console.error("Failed to initialize server:", error);
		process.exit(1);
	}
});
