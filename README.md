# Book Authoring Tool

This is a web-based tool for authors to write and organize their books. It allows uploading text files, which are then chunked into smaller pieces. Authors can edit these chunks, and the tool provides features for organizing them into chapters and sections. The tool also uses AI to help with rewriting and structuring the content.

## Features

*   **File Upload**: Upload `.txt`, `.mp3`, `.m4a` and `.wav` files.
*   **Text Chunking**: Automatically splits the uploaded text into smaller, manageable chunks.
*   **Chunk Editing**: Edit the content of each chunk.
*   **Book Organization**: Organize chunks into chapters and sections.
*   **AI-Powered Rewriting**: Use AI to rewrite chunks of text.
*   **Graph View**: Visualize the structure of the book as a graph.
*   **Vector-based Search**: Search for content within a book using semantic search.

## Running Locally

To run the project locally, you need to have Node.js and npm installed.

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development servers**:
    This command will start the backend server and the ChromaDB server in parallel.
    ```bash
    npm run dev
    ```

4.  **Open the application**:
    Open your browser and navigate to `http://localhost:5173` (or whatever port the Vite server is running on).

## Project Structure

*   `client/`: Contains the frontend code (React, TypeScript, Vite).
*   `server/`: Contains the backend code (Node.js, Express, TypeScript).
*   `shared/`: Contains code shared between the client and server (e.g., data schemas).
*   `chroma_data/`: Directory where ChromaDB stores its data.
*   `package.json`: Lists the project dependencies and scripts.
*   `tsconfig.json`: TypeScript configuration.
*   `vite.config.ts`: Vite configuration.
