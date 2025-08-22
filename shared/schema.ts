import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  originalText: text("original_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chapters = pgTable("chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sections = pgTable("sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  embedding: json("embedding").$type<number[]>(),
  order: integer("order").notNull(),
  similarity: real("similarity"),
  wordCount: integer("word_count"),
  isEmbedded: integer("is_embedded").default(0), // 0 = false, 1 = true
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChapterSchema = createInsertSchema(chapters).omit({
  id: true,
  createdAt: true,
});

export const insertSectionSchema = createInsertSchema(sections).omit({
  id: true,
  createdAt: true,
});

export const insertChunkSchema = createInsertSchema(chunks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateChunkSchema = createInsertSchema(chunks).omit({
  id: true,
  createdAt: true,
}).partial();

export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;

export type InsertBook = z.infer<typeof insertBookSchema>;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type UpdateChunk = z.infer<typeof updateChunkSchema>;

// Additional types for API responses
export type BookStructure = {
  id: string;
  title: string;
  chapters: ChapterWithSections[];
};

export type ChapterWithSections = {
  id: string;
  title: string;
  order: number;
  sections: SectionWithChunks[];
};

export type SectionWithChunks = {
  id: string;
  title: string;
  order: number;
  chunks: Chunk[];
};

export type ProcessingStatus = {
  stage: 'chunking' | 'embedding' | 'clustering' | 'complete';
  progress: number;
  message: string;
};

export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}
