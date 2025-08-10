import { type Book, type Chapter, type Section, type Chunk, type InsertBook, type InsertChapter, type InsertSection, type InsertChunk, type UpdateChunk, type BookStructure } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Book operations
  createBook(book: InsertBook): Promise<Book>;
  getBook(id: string): Promise<Book | undefined>;
  getAllBooks(): Promise<Book[]>;
  deleteBook(id: string): Promise<void>;

  // Chapter operations
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  getChaptersByBookId(bookId: string): Promise<Chapter[]>;
  deleteChaptersByBookId(bookId: string): Promise<void>;

  // Section operations
  createSection(section: InsertSection): Promise<Section>;
  getSectionsByChapterId(chapterId: string): Promise<Section[]>;
  deleteSection(id: string): Promise<void>;

  // Chunk operations
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  getChunk(id: string): Promise<Chunk | undefined>;
  getChunksBySectionId(sectionId: string): Promise<Chunk[]>;
  updateChunk(id: string, chunk: UpdateChunk): Promise<Chunk>;
  deleteChunk(id: string): Promise<void>;
  getAllChunksByBookId(bookId: string): Promise<Chunk[]>;
  swapChunkOrder(chunkId: string, direction: 'up' | 'down'): Promise<void>;

  // Complex queries
  getBookStructure(bookId: string): Promise<BookStructure | undefined>;
}

export class MemStorage implements IStorage {
  private books: Map<string, Book> = new Map();
  private chapters: Map<string, Chapter> = new Map();
  private sections: Map<string, Section> = new Map();
  private chunks: Map<string, Chunk> = new Map();

  async createBook(insertBook: InsertBook): Promise<Book> {
    const id = randomUUID();
    const now = new Date();
    const book: Book = { 
      ...insertBook, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.books.set(id, book);
    return book;
  }

  async getBook(id: string): Promise<Book | undefined> {
    return this.books.get(id);
  }

  async getAllBooks(): Promise<Book[]> {
    return Array.from(this.books.values());
  }

  async deleteBook(id: string): Promise<void> {
    this.books.delete(id);
    // Delete related chapters, sections, and chunks
    const chapters = Array.from(this.chapters.values()).filter(c => c.bookId === id);
    for (const chapter of chapters) {
      const sections = Array.from(this.sections.values()).filter(s => s.chapterId === chapter.id);
      for (const section of sections) {
        const chunks = Array.from(this.chunks.values()).filter(ch => ch.sectionId === section.id);
        chunks.forEach(chunk => this.chunks.delete(chunk.id));
        this.sections.delete(section.id);
      }
      this.chapters.delete(chapter.id);
    }
  }

  async createChapter(insertChapter: InsertChapter): Promise<Chapter> {
    const id = randomUUID();
    const now = new Date();
    const chapter: Chapter = { 
      ...insertChapter, 
      id, 
      createdAt: now
    };
    this.chapters.set(id, chapter);
    return chapter;
  }

  async getChaptersByBookId(bookId: string): Promise<Chapter[]> {
    return Array.from(this.chapters.values())
      .filter(chapter => chapter.bookId === bookId)
      .sort((a, b) => a.order - b.order);
  }

  async deleteChaptersByBookId(bookId: string): Promise<void> {
    const chapters = Array.from(this.chapters.values()).filter(c => c.bookId === bookId);
    for (const chapter of chapters) {
      this.chapters.delete(chapter.id);
    }
  }

  async createSection(insertSection: InsertSection): Promise<Section> {
    const id = randomUUID();
    const now = new Date();
    const section: Section = { 
      ...insertSection, 
      id, 
      createdAt: now
    };
    this.sections.set(id, section);
    return section;
  }

  async getSectionsByChapterId(chapterId: string): Promise<Section[]> {
    return Array.from(this.sections.values())
      .filter(section => section.chapterId === chapterId)
      .sort((a, b) => a.order - b.order);
  }

  async deleteSection(id: string): Promise<void> {
    this.sections.delete(id);
    // Delete related chunks
    const chunks = Array.from(this.chunks.values()).filter(ch => ch.sectionId === id);
    chunks.forEach(chunk => this.chunks.delete(chunk.id));
  }

  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    const id = randomUUID();
    const now = new Date();
    const chunk: Chunk = { 
      ...insertChunk, 
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.chunks.set(id, chunk);
    return chunk;
  }

  async getChunk(id: string): Promise<Chunk | undefined> {
    return this.chunks.get(id);
  }

  async getChunksBySectionId(sectionId: string): Promise<Chunk[]> {
    return Array.from(this.chunks.values())
      .filter(chunk => chunk.sectionId === sectionId)
      .sort((a, b) => a.order - b.order);
  }

  async updateChunk(id: string, updateChunk: UpdateChunk): Promise<Chunk> {
    const existing = this.chunks.get(id);
    if (!existing) {
      throw new Error(`Chunk with id ${id} not found`);
    }
    
    const updated: Chunk = {
      ...existing,
      ...updateChunk,
      updatedAt: new Date(),
    };
    
    this.chunks.set(id, updated);
    return updated;
  }

  async deleteChunk(id: string): Promise<void> {
    this.chunks.delete(id);
  }

  async swapChunkOrder(chunkId: string, direction: 'up' | 'down'): Promise<void> {
    const chunk = await this.getChunk(chunkId);
    if (!chunk) throw new Error("Chunk not found");

    const siblings = await this.getChunksBySectionId(chunk.sectionId);
    const currentIndex = siblings.findIndex(c => c.id === chunkId);

    if (currentIndex === -1) throw new Error("Chunk not found in its section");

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= siblings.length) {
      // Already at the top or bottom
      return;
    }

    const otherChunk = siblings[swapIndex];

    // Swap order property
    const tempOrder = chunk.order;
    chunk.order = otherChunk.order;
    otherChunk.order = tempOrder;

    await this.updateChunk(chunk.id, { order: chunk.order });
    await this.updateChunk(otherChunk.id, { order: otherChunk.order });
  }

  async getAllChunksByBookId(bookId: string): Promise<Chunk[]> {
    const chapters = await this.getChaptersByBookId(bookId);
    const allChunks: Chunk[] = [];
    
    for (const chapter of chapters) {
      const sections = await this.getSectionsByChapterId(chapter.id);
      for (const section of sections) {
        const chunks = await this.getChunksBySectionId(section.id);
        allChunks.push(...chunks);
      }
    }
    
    return allChunks;
  }

  async getBookStructure(bookId: string): Promise<BookStructure | undefined> {
    const book = await this.getBook(bookId);
    if (!book) return undefined;

    const chapters = await this.getChaptersByBookId(bookId);
    const chaptersWithSections = [];

    for (const chapter of chapters) {
      const sections = await this.getSectionsByChapterId(chapter.id);
      const sectionsWithChunks = [];

      for (const section of sections) {
        const chunks = await this.getChunksBySectionId(section.id);
        sectionsWithChunks.push({
          ...section,
          chunks,
        });
      }

      chaptersWithSections.push({
        ...chapter,
        sections: sectionsWithChunks,
      });
    }

    return {
      id: book.id,
      title: book.title,
      chapters: chaptersWithSections,
    };
  }
}

export const storage = new MemStorage();
