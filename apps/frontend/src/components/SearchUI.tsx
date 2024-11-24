import React, { useState } from "react";
import { Search, SortAsc, SortDesc, History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import parse from "html-react-parser";

interface SearchResult {
	filename: string;
	url: string;
	lastModified: string;
	excerpt?: string;
}

const SearchUI: React.FC = () => {
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [sortBy, setSortBy] = useState<"filename" | "date">("filename");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
	const [loading, setLoading] = useState<boolean>(false);
	const [hasSearched, setHasSearched] = useState<boolean>(false);

	const handleSearch = async (): Promise<void> => {
		if (!searchTerm) return;

		setLoading(true);
		setHasSearched(true);
		try {
			const response = await fetch(
				`${
					import.meta.env.VITE_API_URL
				}/api/search?q=${encodeURIComponent(searchTerm)}`
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			setResults(data);
		} catch (error) {
			console.error("Search failed:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const toggleSort = (): void => {
		setSortOrder(sortOrder === "asc" ? "desc" : "asc");
	};

	const handleSort = (value: string) => {
		setSortBy(value as "filename" | "date");
	};

	const replaceTagWithStrong = (excerpt: string | undefined = "") => {
		return excerpt?.replace(/<em>(.*?)<\/em>/g, "<strong>$1</strong>");
	};

	const sortResults = (results: SearchResult[]): SearchResult[] => {
		const sortedResults = [...results].sort((a, b) => {
			const isAscending = sortOrder === "asc";

			if (sortBy === "filename") {
				return isAscending
					? a.filename.localeCompare(b.filename)
					: b.filename.localeCompare(a.filename);
			} else {
				const dateA = new Date(a.lastModified).getTime();
				const dateB = new Date(b.lastModified).getTime();
				return isAscending ? dateA - dateB : dateB - dateA;
			}
		});
		return sortedResults;
	};

	const sortedResults = sortResults(results);

	return (
		<div className="w-full mx-auto px-4 py-8">
			<Card className="w-full max-w-4xl mx-auto">
				<CardHeader>
					<CardTitle>Document Search</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex gap-2">
							<Input
								type="text"
								placeholder="Enter search term..."
								value={searchTerm}
								onChange={(
									e: React.ChangeEvent<HTMLInputElement>
								) => setSearchTerm(e.target.value)}
								onKeyDown={handleKeyPress}
								className="flex-1"
							/>
							<Button
								onClick={handleSearch}
								disabled={loading}
								className="w-24"
							>
								{loading ? (
									"Searching..."
								) : (
									<>
										<Search className="w-4 h-4" />
										Search
									</>
								)}
							</Button>
						</div>

						<div className="flex items-center gap-4">
							<Select
								onValueChange={handleSort}
								defaultValue="filename"
							>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="filename">
										Filename
									</SelectItem>
									<SelectItem value="date">Date</SelectItem>
								</SelectContent>
							</Select>

							<Button
								variant="outline"
								onClick={toggleSort}
								className="flex items-center gap-2"
							>
								{sortOrder === "asc" ? (
									<SortAsc className="w-4 h-4" />
								) : (
									<SortDesc className="w-4 h-4" />
								)}
								{sortOrder === "asc"
									? "Ascending"
									: "Descending"}
							</Button>
						</div>

						<div className="space-y-4 mt-8">
							{sortedResults.map((result, index) => (
								<Card
									key={index}
									className="transition-colors duration-200 hover:bg-gray-50/50"
								>
									<CardContent className="p-6">
										<h3 className="text-lg font-semibold text-gray-900 mb-2">
											{result.filename}
										</h3>

										<div className="text-sm text-gray-500 mb-4">
											<span className="flex items-center gap-2">
												<History className="w-4 h-4" />
												Last modified:{" "}
												{new Date(
													result.lastModified
												).toLocaleDateString()}
											</span>
										</div>

										<div className="bg-gray-100 rounded-lg p-4">
											<span className="block text-sm font-medium text-gray-700 mb-2">
												Passage:
											</span>
											<div className="text-sm text-gray-600">
												{parse(
													replaceTagWithStrong(
														result?.excerpt
													)
												)}
											</div>
										</div>

										<Button
											variant="default"
											onClick={() =>
												window.open(
													result.url,
													"_blank"
												)
											}
											className="mt-4"
										>
											View Document
											<span className="ml-2">→</span>
										</Button>
									</CardContent>
								</Card>
							))}

							{!hasSearched && (
								<div className="text-center py-8">
									<p className="text-gray-500">
										Enter a search term to find documents
									</p>
								</div>
							)}

							{hasSearched &&
								results.length === 0 &&
								!loading &&
								searchTerm && (
									<div className="text-center py-8">
										<p className="text-gray-500">
											No results found for "
											<span className="font-medium">
												{searchTerm}
											</span>
											"
										</p>
									</div>
								)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default SearchUI;
