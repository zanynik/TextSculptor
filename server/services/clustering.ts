import { VectorData } from "./faiss";

export interface ClusterResult {
  clusters: Array<{
    id: string;
    title: string;
    items: string[];
    centroid: number[];
  }>;
}

export class KMeansClustering {
  private maxIterations: number = 100;
  private tolerance: number = 1e-4;

  cluster(vectors: VectorData[], k: number): ClusterResult {
    if (vectors.length === 0) {
      return { clusters: [] };
    }

    if (vectors.length <= k) {
      // If we have fewer or equal vectors than desired clusters, each gets its own cluster
      return {
        clusters: vectors.map((vector, index) => ({
          id: `cluster_${index}`,
          title: `Group ${index + 1}`,
          items: [vector.id],
          centroid: vector.vector,
        })),
      };
    }

    const dimension = vectors[0].vector.length;
    
    // Initialize centroids randomly
    let centroids = this.initializeCentroids(vectors, k, dimension);
    let assignments = new Array(vectors.length).fill(0);
    let prevAssignments = new Array(vectors.length).fill(-1);

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      // Assign points to nearest centroid
      for (let i = 0; i < vectors.length; i++) {
        let minDistance = Infinity;
        let bestCluster = 0;

        for (let j = 0; j < k; j++) {
          const distance = this.euclideanDistance(vectors[i].vector, centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = j;
          }
        }

        assignments[i] = bestCluster;
      }

      // Check for convergence
      if (this.arraysEqual(assignments, prevAssignments)) {
        break;
      }

      prevAssignments = [...assignments];

      // Update centroids
      for (let j = 0; j < k; j++) {
        const clusterPoints = vectors.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          centroids[j] = this.calculateCentroid(clusterPoints.map(p => p.vector));
        }
      }
    }

    // Build result
    const clusters = [];
    for (let j = 0; j < k; j++) {
      const clusterItems = vectors
        .filter((_, i) => assignments[i] === j)
        .map(v => v.id);
      
      if (clusterItems.length > 0) {
        clusters.push({
          id: `cluster_${j}`,
          title: `Group ${j + 1}`,
          items: clusterItems,
          centroid: centroids[j],
        });
      }
    }

    return { clusters };
  }

  private initializeCentroids(vectors: VectorData[], k: number, dimension: number): number[][] {
    const centroids: number[][] = [];
    const used = new Set<number>();

    // Use k-means++ initialization for better results
    // First centroid is random
    const firstIndex = Math.floor(Math.random() * vectors.length);
    centroids.push([...vectors[firstIndex].vector]);
    used.add(firstIndex);

    for (let i = 1; i < k; i++) {
      const distances: number[] = [];
      let totalDistance = 0;

      // Calculate distance from each point to nearest existing centroid
      for (let j = 0; j < vectors.length; j++) {
        if (used.has(j)) {
          distances[j] = 0;
          continue;
        }

        let minDistance = Infinity;
        for (const centroid of centroids) {
          const distance = this.euclideanDistance(vectors[j].vector, centroid);
          minDistance = Math.min(minDistance, distance);
        }

        distances[j] = minDistance * minDistance; // Square for weighted selection
        totalDistance += distances[j];
      }

      // Weighted random selection
      let randomValue = Math.random() * totalDistance;
      let selectedIndex = 0;

      for (let j = 0; j < vectors.length; j++) {
        if (used.has(j)) continue;
        randomValue -= distances[j];
        if (randomValue <= 0) {
          selectedIndex = j;
          break;
        }
      }

      centroids.push([...vectors[selectedIndex].vector]);
      used.add(selectedIndex);
    }

    return centroids;
  }

  private calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const dimension = vectors[0].length;
    const centroid = new Array(dimension).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += vector[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }
}

export function organizeIntoChaptersAndSections(
  clusters: ClusterResult,
  chunkData: Map<string, { content: string; title?: string }>
): Array<{
  title: string;
  sections: Array<{
    title: string;
    chunkIds: string[];
  }>;
}> {
  // For simplicity, treat each cluster as a chapter
  // In a more sophisticated version, we could use hierarchical clustering
  
  return clusters.clusters.map((cluster, index) => {
    // Analyze cluster content to generate better titles
    const clusterContent = cluster.items
      .map(id => chunkData.get(id)?.content || "")
      .join(" ");
    
    const title = generateChapterTitle(clusterContent, index + 1);
    
    // For now, put all chunks in one section per chapter
    // Could be enhanced to sub-cluster into sections
    return {
      title,
      sections: [{
        title: "Overview",
        chunkIds: cluster.items,
      }],
    };
  });
}

function generateChapterTitle(content: string, chapterNumber: number): string {
  // Simple heuristic to generate chapter titles
  // In a real implementation, you might use another LLM call
  
  const words = content.toLowerCase().split(/\s+/);
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
  
  // Find frequent meaningful words
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    if (word.length > 3 && !commonWords.has(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });
  
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  
  if (topWords.length > 0) {
    return `Chapter ${chapterNumber}: ${topWords.join(' & ')}`;
  }
  
  return `Chapter ${chapterNumber}`;
}
