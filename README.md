# Document Search


https://github.com/user-attachments/assets/cb458f48-1500-4eb3-9402-1299af9feb8c


## Overview

A web application that enables users to search through text files stored in Dropbox. The system will index document contents and provide both API and web interface for searching.

## Goals

-   Provide fast and relevant search results
-   Create an intuitive user interface
-   Enable filtering and sorting of results

## Technical Architecture

### Components

1. **Cloud Storage Integration**

    - Integration with Dropbox for document storage
    - File retrieval (.txt)

2. **Elasticsearch**

    - Full-text search
    - Document indexing

3. **Backend API**

    - RESTful endpoint for search
    - Authentication & authorization
    - Rate limiting

4. **Frontend Interface**
    - Search input
    - Results display
    - Sort options

### API Specifications

#### Search Endpoint

```
GET /api/search
Query Parameters:
- q: search query (required)
```

Response Format:

```json
{
  "results": [
    {
      "filename": string,
      "url": string,
      "lastModified": string,
      "score": number,
      "excerpt": string
    }
  ],
}
```

## User Interface

### Search Page

-   Search bar
-   Sort options
    -   Score
    -   Filename
    -   Date
-   Results list with:
    -   File name
    -   Last modified date
    -   Relevance search score
    -   Content preview with highlighted matches
    -   Full document view link

## Installation guide

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

-   **Node.js** with npm (https://nodejs.org/)
-   **Docker Desktop** (https://www.docker.com/products/docker-desktop/)
-   **Dropbox Account:** Create a dropbox app (https://www.dropbox.com/developers/apps/create) and enable the following permissions:
    -   account_info.read
    -   files.metadata.write
    -   files.metadata.read
    -   files.content.write
    -   files.content.read
    -   sharing.write
    -   sharing.read
-   **Upload txt files:** Upload txt files to the newly created Dropbox app.

**Setting Up Elasticsearch:**
To set up an Elasticsearch container locally, follow these steps:

1.  Open your terminal or command prompt.
    Run the following command to start an Elasticsearch container:

        ```bash
        docker run -d \
        --name document-search \
        -p 9200:9200 \
        -e "discovery.type=single-node" \
        -e "xpack.security.enabled=false" \
        elasticsearch:8.16.0
        ```

    **Note**: Verify and use the latest version of Elasticsearch. Check the official documentation if you encounter any issues.

2.  Start the document-search container and verify if it is working by testing:

    ```bash
    http://localhost:9200
    ```

    You should see a response indicating that Elasticsearch is running.

### Codebase setup

1.  **Clone the Repository**

    Clone the repository to your local machine using:

    ```bash
    git clone https://github.com/RajuKalidindi/document-search.git
    ```

2.  **Navigate into the Project Directory:**

    ```bash
    cd document-search
    ```

3.  **Install Dependencies:**

    ```bash
    npm install
    ```

4.  **Configuring Environment Variables:**

    You need to create .env files in both `/apps/frontend` and `/apps/backend` directories with the following configurations:

    **Frontend .env:**
    Create a file named .env in `/apps/frontend` with the following content:

    Set the VITE_API_KEY variable inside the .env:

    ```bash
    VITE_API_KEY=http://localhost:3001
    ```

    **Backend .env:**
    Create a file named .env in `/apps/backend` with the following content:

    ```bash
    ELASTICSEARCH_NODE="http://localhost:9200"
    DROPBOX_ACCESS_TOKEN={dropbox_access_token}
    DROPBOX_APP_KEY={dropbox_app_key}
    DROPBOX_APP_SECRET={dropbox_app_secret}
    DROPBOX_REFRESH_TOKEN={dropbox_refresh_token}
    ```

    **Note:** Fill in your Dropbox credentials accordingly.

5.  **Running the Application:**

    To start the application, run the following command:

    ```bash
    npx turbo dev
    ```

    -   This command will start both frontend and backend services, allowing you to access the application locally.
    -   Open your web browser and navigate to http://localhost:5173 to view your application in action.
    -   Backend server would be running at http://localhost:3001/api/search?q={search_term}

    **Note:** Replace `{search_term}` with the term you wish to search for.
