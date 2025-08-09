// In-memory vector storage simulation since FAISS-node may not be available
// This provides similar functionality for small datasets

export interface VectorData {
  id: string;
  vector: number[];
  metadata?: any;
}

export class InMemoryVectorStore {
  private vectors: Map<string, VectorData> = new Map();
  private dimension: number = 0;

  add(id: string, vector: number[], metadata?: any): void {
    if (this.dimension === 0) {
      this.dimension = vector.length;
    } else if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`);
    }

    this.vectors.set(id, { id, vector, metadata });
  }

  remove(id: string): boolean {
    return this.vectors.delete(id);
  }

  search(queryVector: number[], topK: number = 5): Array<{ id: string; score: number; metadata?: any }> {
    if (queryVector.length !== this.dimension) {
      throw new Error(`Query vector dimension mismatch. Expected ${this.dimension}, got ${queryVector.length}`);
    }

    const results = Array.from(this.vectors.values())
      .map(item => ({
        id: item.id,
        score: this.cosineSimilarity(queryVector, item.vector),
        metadata: item.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  getAllVectors(): VectorData[] {
    return Array.from(this.vectors.values());
  }

  size(): number {
    return this.vectors.size;
  }

  clear(): void {
    this.vectors.clear();
    this.dimension = 0;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }
}

// Global vector store instance
export const vectorStore = new InMemoryVectorStore();
