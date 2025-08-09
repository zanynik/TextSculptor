import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface TextChunk {
  content: string;
  title?: string;
}

export interface ChunkingResult {
  chunks: TextChunk[];
  suggestedTitle: string;
}

export async function chunkText(text: string): Promise<ChunkingResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert text organizer. Split the following messy personal notes into coherent paragraphs or sections, each representing a single idea or topic. 

          Rules:
          - Each chunk should be 1-3 paragraphs
          - Chunks should be coherent and self-contained
          - Maintain the original meaning and content
          - Suggest a title for the overall document
          - Return as JSON in this exact format: { "chunks": [{"content": "text", "title": "optional section title"}], "suggestedTitle": "document title" }`
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (!result.chunks || !Array.isArray(result.chunks)) {
      throw new Error("Invalid response format from OpenAI");
    }

    return {
      chunks: result.chunks.map((chunk: any) => ({
        content: chunk.content || "",
        title: chunk.title,
      })),
      suggestedTitle: result.suggestedTitle || "Untitled Document",
    };
  } catch (error) {
    console.error("Error chunking text:", error);
    throw new Error("Failed to process text with AI: " + (error as Error).message);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding: " + (error as Error).message);
  }
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error("Error generating batch embeddings:", error);
    throw new Error("Failed to generate embeddings: " + (error as Error).message);
  }
}
