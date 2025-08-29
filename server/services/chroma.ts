import { ChromaClient, type Collection } from 'chromadb';

// This class will replace the InMemoryVectorStore and provide a similar interface
// for interacting with a vector database, but backed by ChromaDB.
export class ChromaVectorStore {
  private client: ChromaClient;
  private collectionName: string;
  private collection: Collection | undefined;

  constructor(collectionName: string = "book-chunks") {
    // Initialize the ChromaClient. By default, it runs in-memory
    // and persists data to disk in the .chroma folder.
    this.client = new ChromaClient();
    this.collectionName = collectionName;
  }

  // Ensures the collection is initialized before use.
  // It uses cosine distance to match the previous implementation's similarity metric.
  private async initialize(): Promise<void> {
    if (this.collection) {
      return;
    }
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { "hnsw:space": "cosine" },
      });
    } catch (error) {
      console.error("Failed to initialize ChromaDB collection:", error);
      throw error;
    }
  }

  // Adds a vector to the collection.
  async add(id: string, vector: number[], metadata?: any): Promise<void> {
    await this.initialize();
    if (!this.collection) {
        throw new Error("Collection not initialized");
    }

    await this.collection.add({
      ids: [id],
      embeddings: [vector],
      metadatas: [metadata || {}],
      documents: [metadata?.content || ''] // Documents are optional but good practice
    });
  }

  // Removes a vector from the collection by its ID.
  async remove(id: string): Promise<boolean> {
    await this.initialize();
    if (!this.collection) {
        throw new Error("Collection not initialized");
    }
    try {
      await this.collection.delete({ ids: [id] });
      return true;
    } catch (error) {
        console.error(`Failed to remove vector with id ${id}:`, error);
        return false;
    }
  }

  // Searches for the most similar vectors.
  async search(queryVector: number[], topK: number = 5): Promise<Array<{ id: string; score: number; metadata?: any }>> {
    await this.initialize();
    if (!this.collection) {
        throw new Error("Collection not initialized");
    }

    const results = await this.collection.query({
      queryEmbeddings: [queryVector],
      nResults: topK,
    });

    // The results need to be mapped to the format expected by the application.
    // The distance for cosine is 1 - similarity, so we convert it back.
    const ids = results.ids[0] || [];
    const distances = results.distances ? results.distances[0] : [];
    const metadatas = results.metadatas[0] || [];

    return ids.map((id, index) => ({
      id: id,
      score: distances[index] !== null ? 1 - distances[index] : 0,
      metadata: metadatas[index],
    }));
  }

  // Returns the number of items in the collection.
  async size(): Promise<number> {
      await this.initialize();
      if (!this.collection) {
        throw new Error("Collection not initialized");
    }
      return await this.collection.count();
  }

  // Clears the collection by deleting and recreating it.
  async clear(): Promise<void> {
    await this.initialize();
    if (!this.collection) {
        throw new Error("Collection not initialized");
    }
    await this.client.deleteCollection({ name: this.collectionName });
    // Re-initialize the collection after clearing
    this.collection = undefined;
    await this.initialize();
  }
}

// Create a global instance of the vector store for use throughout the server.
export const vectorStore = new ChromaVectorStore();
