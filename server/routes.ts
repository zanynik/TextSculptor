import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBookSchema, insertChunkSchema, updateChunkSchema, isNumberArray } from "@shared/schema";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Readable } from "stream";
import { chunkText, generateEmbedding, generateBatchEmbeddings, rewriteChunk, type TextChunk } from "./services/openai";
import { localAIService } from "./services/local-ai";
import { vectorStore } from "./services/chroma"; // Changed from faiss to chroma
import { graphStorage } from "./services/graph";
// import { KMeansClustering, organizeIntoChaptersAndSections } from "./services/clustering"; // Removed clustering
import multer from "multer";
import type { Request, Response } from "express";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Function to convert audio buffer to WAV buffer
function convertAudioToWav(audioBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const readableStream = new Readable();
    readableStream.push(audioBuffer);
    readableStream.push(null);

    const buffers: any[] = [];
    ffmpeg(readableStream)
      .toFormat('wav')
      .on('error', (err) => {
        reject(new Error(`Audio conversion error: ${err.message}`));
      })
      .on('end', () => {
        resolve(Buffer.concat(buffers));
      })
      .pipe()
      .on('data', (chunk) => {
        buffers.push(chunk);
      });
  });
}

// Simple local text chunker
function localChunkText(text: string): TextChunk[] {
  // A basic chunking strategy: split by paragraphs (double newlines)
  // and then group into chunks of a certain size.
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: TextChunk[] = [];
  let currentChunkContent = "";

  for (const paragraph of paragraphs) {
    if (currentChunkContent.length + paragraph.length > 1000) { // Approx. chunk size
      chunks.push({ title: "Chunk", content: currentChunkContent.trim() });
      currentChunkContent = "";
    }
    currentChunkContent += paragraph + "\n\n";
  }

  if (currentChunkContent.trim().length > 0) {
    chunks.push({ title: "Chunk", content: currentChunkContent.trim() });
  }

  // If there are no paragraphs, split by sentences.
  if (chunks.length === 0 && text.length > 0) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    chunks.push(...sentences.map(s => ({ title: "Chunk", content: s.trim() })));
  }

  // Add sequential titles
  return chunks.map((chunk, i) => ({ ...chunk, title: `Chunk ${i + 1}` }));
}

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .mp3, .m4a and .wav files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload and process text file(s)
  app.post("/api/upload", upload.array('files'), async (req: Request, res: Response) => {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      const originalFiles: Array<{ filename: string; content: string }> = [];

      for (const file of files) {
        let content = '';
        if (file.mimetype.startsWith('audio/')) {
          try {
            const wavBuffer = await convertAudioToWav(file.buffer);
            content = await localAIService.transcribeAudio(wavBuffer);
          } catch (error) {
            console.error(`Failed to process audio file ${file.originalname}:`, error);
            // Optionally, you could decide to skip the file or return an error response
            content = ''; // Or handle as a failed transcription
          }
        } else {
          content = file.buffer.toString('utf-8');
        }
        originalFiles.push({ filename: file.originalname, content });
      }

      if (originalFiles.every(file => !file.content.trim())) {
        return res.status(400).json({ message: "Files are empty or contain no speech" });
      }

      const { bookId, rewriteLevel, embeddingType } = req.body;
      let book;

      let embeddingTypeToUse: 'openai' | 'local' = embeddingType || 'openai';
      let collectionName: string;

      if (bookId) {
        const existingBook = await storage.getBook(bookId);
        if (!existingBook) {
          return res.status(404).json({ message: "Book not found" });
        }
        embeddingTypeToUse = existingBook.embeddingType;
        collectionName = `collection_${embeddingTypeToUse}`;

        const oldChunks = await storage.getAllChunksByBookId(bookId);
        await Promise.all(oldChunks.map(chunk => vectorStore.remove(collectionName, chunk.id)));
        await storage.deleteChaptersByBookId(bookId);
      } else {
        collectionName = `collection_${embeddingTypeToUse}`;
      }

      let suggestedTitle = "Untitled Book";
      let initialChunks: TextChunk[] = [];

      if (embeddingTypeToUse === 'local') {
        suggestedTitle = originalFiles[0]?.filename || "Untitled Book";
        initialChunks = localChunkText(originalFiles[0]?.content || '');
      } else {
        const firstFileContent = originalFiles[0]?.content || '';
        const initialChunkingResult = await chunkText(firstFileContent, rewriteLevel ? parseFloat(rewriteLevel) : 0.5);
        suggestedTitle = initialChunkingResult.suggestedTitle;
        initialChunks = initialChunkingResult.chunks;
      }
      
      book = await storage.createBook({
        title: suggestedTitle,
        originalFiles: originalFiles,
        embeddingType: embeddingTypeToUse,
      });

      await graphStorage.init();

      let chapterOrder = 0;
      for (const file of originalFiles) {
        // Step 1: Create a chapter for each file
        const chapter = await storage.createChapter({
          bookId: book.id,
          title: file.filename,
          order: chapterOrder++,
        });

        // Step 2: Create a single section for the chapter
        const section = await storage.createSection({
          chapterId: chapter.id,
          title: "Content",
          order: 0,
        });

        // Step 3: Chunk the text
        let chunks: TextChunk[];
        if (embeddingTypeToUse === 'local') {
          chunks = localChunkText(file.content);
        } else {
          const chunkingResult = await chunkText(file.content, rewriteLevel ? parseFloat(rewriteLevel) : 0.5);
          chunks = chunkingResult.chunks;
        }
        if (chunks.length === 0) continue;

        // Step 4: Generate embeddings
        const chunkContents = chunks.map(c => c.content);
        let embeddings: number[][];
        if (embeddingTypeToUse === 'local') {
          embeddings = await localAIService.generateBatchEmbeddings(chunkContents);
        } else {
          embeddings = await generateBatchEmbeddings(chunkContents);
        }

        // Step 5: Process and store chunks
        const createdChunks = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunkInfo = chunks[i];
          const embedding = embeddings[i];

          const newChunk = await storage.createChunk({
            sectionId: section.id,
            filename: file.filename,
            title: chunkInfo.title,
            content: chunkInfo.content,
            embedding: embedding,
            order: i,
            wordCount: chunkInfo.content.split(/\s+/).length,
            isEmbedded: 1,
          });

          createdChunks.push(newChunk);
          await vectorStore.add(collectionName, newChunk.id, embedding, {
            content: newChunk.content,
            title: newChunk.title,
            bookId: book.id,
            chunkId: newChunk.id,
            filename: file.filename,
          });
        }

        // Step 6: Link chunks within the same file
        for (let i = 0; i < createdChunks.length - 1; i++) {
          const currentChunk = createdChunks[i];
          const nextChunk = createdChunks[i + 1];
          await storage.updateChunk(currentChunk.id, { nextChunkId: nextChunk.id });
        }

        // Step 7: Add to graph database
        for (const chunk of createdChunks) {
          await graphStorage.addNode(book.id, chunk.id, { title: chunk.title, order: chunk.order, filename: file.filename });
        }
        for (let i = 0; i < createdChunks.length - 1; i++) {
          await graphStorage.addEdge(book.id, createdChunks[i].id, createdChunks[i + 1].id, 'next');
        }
      }

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
  app.get("/api/books", async (req: Request, res: Response) => {
    try {
      const books = await storage.getAllBooks();
      res.json(books);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  // Get book structure
  app.get("/api/books/:id", async (req: Request, res: Response) => {
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

  // Get book graph
  app.get("/api/books/:id/graph", async (req: Request, res: Response) => {
    try {
      const graph = await graphStorage.getGraph(req.params.id);
      if (!graph) {
        return res.status(404).json({ message: "Graph not found for this book" });
      }
      res.json(graph);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch graph" });
    }
  });

  // Update chunk content
  app.patch("/api/chunks/:id", async (req: Request, res: Response) => {
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
        const book = await storage.getBookFromChunk(req.params.id);
        if (!book) {
          return res.status(404).json({ message: "Book not found for this chunk" });
        }

        const collectionName = `collection_${book.embeddingType}`;
        let newEmbedding: number[];

        if (book.embeddingType === 'local') {
          newEmbedding = await localAIService.generateEmbedding(updates.content);
        } else {
          newEmbedding = await generateEmbedding(updates.content);
        }

        updates.embedding = newEmbedding;
        updates.wordCount = updates.content.split(/\s+/).length;
        updates.isEmbedded = 1;
        
        // Update vector store
        await vectorStore.add(collectionName, req.params.id, newEmbedding, {
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
  app.delete("/api/chunks/:id", async (req: Request, res: Response) => {
    try {
      const chunk = await storage.getChunk(req.params.id);
      if (!chunk) {
        return res.status(404).json({ message: "Chunk not found" });
      }

      const book = await storage.getBookFromChunk(req.params.id);
      if (book) {
        const collectionName = `collection_${book.embeddingType}`;
        await vectorStore.remove(collectionName, req.params.id);
      }

      await storage.deleteChunk(req.params.id);
      
      res.json({ message: "Chunk deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete chunk" });
    }
  });

  // Create a new chunk in a section
  app.post("/api/sections/:id/chunks", async (req: Request, res: Response) => {
    try {
      const section = await storage.getSection(req.params.id);
      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }

      const { content = '', order } = req.body;

      const newChunk = await storage.createChunk({
        sectionId: req.params.id,
        content,
        order,
        isEmbedded: 0,
        wordCount: 0,
      });

      res.json(newChunk);
    } catch (error) {
      console.error("Chunk creation error:", error);
      res.status(500).json({
        message: "Failed to create chunk",
        error: (error as Error).message,
      });
    }
  });

  // Rewrite chunk content
  app.post("/api/chunks/:id/rewrite", async (req: Request, res: Response) => {
    try {
      const { rewriteLevel } = req.body;
      const chunk = await storage.getChunk(req.params.id);

      if (!chunk) {
        return res.status(404).json({ message: "Chunk not found" });
      }

      const { content: rewrittenContent } = await rewriteChunk(chunk.content, rewriteLevel);

      // We'll just return the rewritten content for the user to confirm,
      // not saving it to DB yet.
      res.json({ content: rewrittenContent });

    } catch (error) {
      console.error("Chunk rewrite error:", error);
      res.status(500).json({
        message: "Failed to rewrite chunk",
        error: (error as Error).message,
      });
    }
  });

  // Reorder chunk
  app.post("/api/chunks/:id/reorder", async (req: Request, res: Response) => {
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
  app.get("/api/books/:id/export", async (req: Request, res: Response) => {
    try {
      const bookStructure = await storage.getBookStructure(req.params.id);
      if (!bookStructure) {
        return res.status(404).json({ message: "Book not found" });
      }

      let markdown = `# ${bookStructure.title}\n\n`;
      
      for (const chapter of bookStructure.chapters) {
        markdown += `## ${chapter.title}\n\n`;
        
        for (const section of chapter.sections) {
          // Section titles are now always included, as "Overview" is filtered on the client
          markdown += `### ${section.title}\n\n`;
          
          for (const chunk of section.chunks) {
            if (chunk.title) {
              markdown += `#### ${chunk.title}\n\n`;
            }
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
  // This endpoint is now problematic because it relies on clustering.
  // I will disable it for now by returning an error.
  app.post("/api/books/:id/reorganize", async (req: Request, res: Response) => {
    try {
      return res.status(400).json({ message: "Book reorganization is not supported in the new workflow." });
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
