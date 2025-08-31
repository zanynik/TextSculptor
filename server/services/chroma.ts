import { ChromaClient, type Collection } from 'chromadb';

export class ChromaVectorStore {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();

  constructor() {
    this.client = new ChromaClient();
  }

  private async getCollection(collectionName: string): Promise<Collection> {
    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName)!;
    }

    try {
      const collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: { "hnsw:space": "cosine" },
      });
      this.collections.set(collectionName, collection);
      return collection;
    } catch (error) {
      console.error(`Failed to initialize ChromaDB collection "${collectionName}":`, error);
      throw error;
    }
  }

  async add(collectionName: string, id: string, vector: number[], metadata?: any): Promise<void> {
    const collection = await this.getCollection(collectionName);
    await collection.add({
      ids: [id],
      embeddings: [vector],
      metadatas: [metadata || {}],
      documents: [metadata?.content || '']
    });
  }

  async remove(collectionName: string, id: string): Promise<boolean> {
    const collection = await this.getCollection(collectionName);
    try {
      await collection.delete({ ids: [id] });
      return true;
    } catch (error) {
      console.error(`Failed to remove vector with id ${id} from collection ${collectionName}:`, error);
      return false;
    }
  }

  async search(collectionName: string, queryVector: number[], topK: number = 5, where: object = {}): Promise<Array<{ id: string; score: number; metadata?: any }>> {
    const collection = await this.getCollection(collectionName);
    const results = await collection.query({
      queryEmbeddings: [queryVector],
      nResults: topK,
      where,
    });

    const ids = results.ids[0] || [];
    const distances = results.distances ? results.distances[0] : [];
    const metadatas = results.metadatas[0] || [];

    return ids.map((id, index) => ({
      id: id,
      score: distances[index] !== null ? 1 - distances[index] : 0,
      metadata: metadatas[index],
    }));
  }

  async size(collectionName: string): Promise<number> {
    const collection = await this.getCollection(collectionName);
    return await collection.count();
  }

  async clear(collectionName: string): Promise<void> {
    await this.getCollection(collectionName); // Ensure it exists
    await this.client.deleteCollection({ name: collectionName });
    this.collections.delete(collectionName);
  }
}

// Create a global instance of the vector store for use throughout the server.
export const vectorStore = new ChromaVectorStore();
