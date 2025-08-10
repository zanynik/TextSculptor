import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookSchema, insertChunkSchema, updateChunkSchema } from "@shared/schema";
import { chunkText, generateEmbedding, generateBatchEmbeddings } from "./services/openai";
import { vectorStore } from "./services/faiss";
import { KMeansClustering, organizeIntoChaptersAndSections } from "./services/clustering";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload and process text file(s)
  app.post("/api/upload", upload.array('files'), async (req, res) => {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      let text = files.map(file => file.buffer.toString('utf-8')).join('\n\n');

      if (!text.trim()) {
        return res.status(400).json({ message: "Files are empty" });
      }

      const { bookId } = req.body;
      let book;

      if (bookId) {
        book = await storage.getBook(bookId);
        if (book) {
          // Append text and delete old structure
          const existingText = book.originalText || '';
          text = existingText + '\n\n' + text;

          const oldChunks = await storage.getAllChunksByBookId(bookId);
          oldChunks.forEach(chunk => vectorStore.remove(chunk.id));
          await storage.deleteChaptersByBookId(bookId);

          book.originalText = text; // Update original text
        }
      }

      // Step 1: Chunk the text using OpenAI
      const chunkingResult = await chunkText(text);
      
      // Step 2: Create or update book record
      if (!book) {
        book = await storage.createBook({
          title: chunkingResult.suggestedTitle,
          originalText: text,
        });
      } else {
        // Optional: update title if it was a placeholder
        // book.title = chunkingResult.suggestedTitle;
      }

      // Step 3: Generate embeddings for all chunks
      const chunkContents = chunkingResult.chunks.map(chunk => chunk.content);
      const embeddings = await generateBatchEmbeddings(chunkContents);

      // Step 4: Store vectors in FAISS
      const chunkData = new Map<string, { content: string; title?: string }>();
      chunkingResult.chunks.forEach((chunk, index) => {
        const chunkId = `chunk_${index}`;
        vectorStore.add(chunkId, embeddings[index], { 
          content: chunk.content,
          title: chunk.title,
          bookId: book.id 
        });
        chunkData.set(chunkId, chunk);
      });

      // Step 5: Cluster the vectors
      const clustering = new KMeansClustering();
      const numClusters = Math.min(Math.max(2, Math.ceil(chunkingResult.chunks.length / 4)), 6);
      const vectorData = Array.from({ length: chunkingResult.chunks.length }, (_, i) => ({
        id: `chunk_${i}`,
        vector: embeddings[i],
        metadata: chunkData.get(`chunk_${i}`)
      }));
      
      const clusterResult = clustering.cluster(vectorData, numClusters);
      
      // Step 6: Organize into chapters and sections
      const structure = organizeIntoChaptersAndSections(clusterResult, chunkData);

      // Step 7: Create database records
      for (let chapterIndex = 0; chapterIndex < structure.length; chapterIndex++) {
        const chapterData = structure[chapterIndex];
        const chapter = await storage.createChapter({
          bookId: book.id,
          title: chapterData.title,
          order: chapterIndex,
        });

        for (let sectionIndex = 0; sectionIndex < chapterData.sections.length; sectionIndex++) {
          const sectionData = chapterData.sections[sectionIndex];
          const section = await storage.createSection({
            chapterId: chapter.id,
            title: sectionData.title,
            order: sectionIndex,
          });

          for (let chunkIndex = 0; chunkIndex < sectionData.chunkIds.length; chunkIndex++) {
            const chunkId = sectionData.chunkIds[chunkIndex];
            const originalIndex = parseInt(chunkId.split('_')[1]);
            const chunk = chunkingResult.chunks[originalIndex];
            const embedding = embeddings[originalIndex];

            await storage.createChunk({
              sectionId: section.id,
              content: chunk.content,
              embedding,
              order: chunkIndex,
              similarity: 0.95, // Placeholder - could calculate actual similarity
              wordCount: chunk.content.split(/\s+/).length,
              isEmbedded: 1,
            });
          }
        }
      }

      // Return the book structure
      const bookStructure = await storage.getBookStructure(book.id);
      res.json(bookStructure);

    } catch (error) {
      console.error("Upload processing error:", error);
      res.status(500).json({ 
        message: "Failed to process file", 
        error: (error as Error).message 
      });
    }
  });

  // Get all books
  app.get("/api/books", async (req, res) => {
    try {
      const books = await storage.getAllBooks();
      res.json(books);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  // Get book structure
  app.get("/api/books/:id", async (req, res) => {
    try {
      const bookStructure = await storage.getBookStructure(req.params.id);
      if (!bookStructure) {
        return res.status(404).json({ message: "Book not found" });
      }
      res.json(bookStructure);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch book" });
    }
  });

  // Update chunk content
  app.patch("/api/chunks/:id", async (req, res) => {
    try {
      const validation = updateChunkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: validation.error.errors 
        });
      }

      const chunk = await storage.getChunk(req.params.id);
      if (!chunk) {
        return res.status(404).json({ message: "Chunk not found" });
      }

      const updates = validation.data;
      
      // If content changed, regenerate embedding
      if (updates.content && updates.content !== chunk.content) {
        updates.embedding = await generateEmbedding(updates.content);
        updates.wordCount = updates.content.split(/\s+/).length;
        updates.isEmbedded = 1;
        
        // Update vector store
        vectorStore.add(req.params.id, updates.embedding, {
          content: updates.content,
          chunkId: req.params.id
        });
      }

      const updatedChunk = await storage.updateChunk(req.params.id, updates);
      res.json(updatedChunk);

    } catch (error) {
      console.error("Chunk update error:", error);
      res.status(500).json({ 
        message: "Failed to update chunk", 
        error: (error as Error).message 
      });
    }
  });

  // Delete chunk
  app.delete("/api/chunks/:id", async (req, res) => {
    try {
      const chunk = await storage.getChunk(req.params.id);
      if (!chunk) {
        return res.status(404).json({ message: "Chunk not found" });
      }

      await storage.deleteChunk(req.params.id);
      vectorStore.remove(req.params.id);
      
      res.json({ message: "Chunk deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete chunk" });
    }
  });

  // Reorder chunk
  app.post("/api/chunks/:id/reorder", async (req, res) => {
    try {
      const { direction } = req.body;
      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({ message: "Invalid direction" });
      }

      await storage.swapChunkOrder(req.params.id, direction);
      res.json({ message: "Chunk reordered successfully" });

    } catch (error) {
      console.error("Chunk reorder error:", error);
      res.status(500).json({
        message: "Failed to reorder chunk",
        error: (error as Error).message
      });
    }
  });

  // Export book as text/markdown
  app.get("/api/books/:id/export", async (req, res) => {
    try {
      const bookStructure = await storage.getBookStructure(req.params.id);
      if (!bookStructure) {
        return res.status(404).json({ message: "Book not found" });
      }

      let markdown = `# ${bookStructure.title}\n\n`;
      
      for (const chapter of bookStructure.chapters) {
        markdown += `## ${chapter.title}\n\n`;
        
        for (const section of chapter.sections) {
          if (section.title !== "Overview") {
            markdown += `### ${section.title}\n\n`;
          }
          
          for (const chunk of section.chunks) {
            markdown += `${chunk.content}\n\n`;
          }
        }
      }

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${bookStructure.title}.md"`);
      res.send(markdown);

    } catch (error) {
      res.status(500).json({ message: "Failed to export book" });
    }
  });

  // Re-organize book structure
  app.post("/api/books/:id/reorganize", async (req, res) => {
    try {
      const bookStructure = await storage.getBookStructure(req.params.id);
      if (!bookStructure) {
        return res.status(404).json({ message: "Book not found" });
      }

      // Get all chunks for the book
      const allChunks = await storage.getAllChunksByBookId(req.params.id);
      
      // Rebuild vector data
      const vectorData = allChunks
        .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
        .map(chunk => ({
          id: chunk.id,
          vector: chunk.embedding!,
          metadata: { content: chunk.content }
        }));

      if (vectorData.length === 0) {
        return res.status(400).json({ message: "No embedded chunks found" });
      }

      // Re-cluster
      const clustering = new KMeansClustering();
      const numClusters = Math.min(Math.max(2, Math.ceil(vectorData.length / 4)), 6);
      const clusterResult = clustering.cluster(vectorData, numClusters);

      // Create new structure map
      const chunkData = new Map<string, { content: string; title?: string }>();
      allChunks.forEach(chunk => {
        chunkData.set(chunk.id, { content: chunk.content });
      });

      const newStructure = organizeIntoChaptersAndSections(clusterResult, chunkData);

      // Delete existing chapters/sections (but keep chunks)
      await storage.deleteChaptersByBookId(req.params.id);

      // Create new structure
      for (let chapterIndex = 0; chapterIndex < newStructure.length; chapterIndex++) {
        const chapterData = newStructure[chapterIndex];
        const chapter = await storage.createChapter({
          bookId: req.params.id,
          title: chapterData.title,
          order: chapterIndex,
        });

        for (let sectionIndex = 0; sectionIndex < chapterData.sections.length; sectionIndex++) {
          const sectionData = chapterData.sections[sectionIndex];
          const section = await storage.createSection({
            chapterId: chapter.id,
            title: sectionData.title,
            order: sectionIndex,
          });

          // Update chunk section assignments
          for (let chunkIndex = 0; chunkIndex < sectionData.chunkIds.length; chunkIndex++) {
            const chunkId = sectionData.chunkIds[chunkIndex];
            await storage.updateChunk(chunkId, {
              sectionId: section.id,
              order: chunkIndex,
            });
          }
        }
      }

      // Return updated book structure
      const updatedBookStructure = await storage.getBookStructure(req.params.id);
      res.json(updatedBookStructure);

    } catch (error) {
      console.error("Reorganization error:", error);
      res.status(500).json({ 
        message: "Failed to reorganize book", 
        error: (error as Error).message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
