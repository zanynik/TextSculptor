import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class GraphStorage {
  private db: Awaited<ReturnType<typeof open>> | null = null;
  private dbPath: string;

  constructor(dbPath: string = './graph.db') {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS edges (
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        book_id TEXT NOT NULL,
        label TEXT,
        PRIMARY KEY (source, target, book_id)
      );
    `);
  }

  async addNode(bookId: string, chunkId: string, data: any): Promise<void> {
    if (!this.db) {
      await this.init();
    }
    const stmt = await this.db!.prepare('INSERT OR REPLACE INTO nodes (id, book_id, chunk_id, data) VALUES (?, ?, ?, ?)');
    await stmt.run(chunkId, bookId, chunkId, JSON.stringify(data));
    await stmt.finalize();
  }

  async addEdge(bookId: string, sourceChunkId: string, targetChunkId: string, label: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }
    const stmt = await this.db!.prepare('INSERT OR REPLACE INTO edges (book_id, source, target, label) VALUES (?, ?, ?, ?)');
    await stmt.run(bookId, sourceChunkId, targetChunkId, label);
    await stmt.finalize();
  }

  async getGraph(bookId: string): Promise<{ nodes: any[], edges: any[] }> {
    if (!this.db) {
      await this.init();
    }
    const nodes = await this.db!.all('SELECT * FROM nodes WHERE book_id = ?', bookId);
    const edges = await this.db!.all('SELECT * FROM edges WHERE book_id = ?', bookId);

    return {
      nodes: nodes.map((n: { chunk_id: string, data: string }) => ({ id: n.chunk_id, ...JSON.parse(n.data) })),
      edges: edges.map((e: { source: string, target: string, label: string }) => ({ source: e.source, target: e.target, label: e.label })),
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export const graphStorage = new GraphStorage();
