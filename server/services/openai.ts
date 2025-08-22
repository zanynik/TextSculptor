import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('OpenAI API Key (last 10 chars):', apiKey ? '...' + apiKey.slice(-10) : 'NOT SET');
  
  if (!apiKey || apiKey === "default_key") {
    throw new Error("OpenAI API key not properly configured");
  }
  
  return new OpenAI({ 
    apiKey: apiKey
  });
}

export interface TextChunk {
  content: string;
  title?: string;
}

export interface ChunkingResult {
  chunks: TextChunk[];
  suggestedTitle: string;
}

function getReasoningEffort(level: number): 'minimal' | 'low' | 'medium' | 'high' {
  if (level < 0.3) return 'minimal';
  if (level < 0.6) return 'low';
  if (level < 0.9) return 'medium';
  return 'high';
}

export async function chunkText(text: string, rewriteLevel: number = 0.5): Promise<ChunkingResult> {
  try {
    const openai = getOpenAIClient();
    const reasoningEffort = getReasoningEffort(rewriteLevel);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert text organizer. Your task is to process unstructured text and organize it into a coherent book-like structure.

          1.  **Analyze the entire text** to understand its underlying themes and topics.
          2.  **Suggest a concise, descriptive title** for the entire document. This should be the main title of the book.
          3.  **Divide the text into logical chunks.** Each chunk should focus on a single, self-contained idea.
          4.  **For each chunk, create a short, informative title.** This will serve as a section heading.
          5.  **Control the level of rewriting** based on the user's preference, indicated by reasoning_effort. 'minimal' means literal chunking. 'high' allows for significant rewriting to improve clarity.

          **Output Format:**
          Return a single JSON object with the following structure:
          {
            "suggestedTitle": "Your Document Title",
            "chunks": [
              { "title": "Section Title 1", "content": "The first chunk of text..." },
              { "title": "Section Title 2", "content": "The second chunk of text..." }
            ]
          }`
        },
        {
          role: "user",
          content: text,
        },
      ],
      reasoning_effort: reasoningEffort,
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

export async function rewriteChunk(
  content: string,
  rewriteLevel: number = 0.5
): Promise<{ content: string }> {
  try {
    const openai = getOpenAIClient();
    const reasoningEffort = getReasoningEffort(rewriteLevel);

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert text editor. Your task is to rewrite the given text based on the user's preferred level of intensity, controlled by 'reasoning_effort'.
          - 'minimal': Fix grammar and spelling only.
          - 'low': Improve clarity and flow slightly.
          - 'medium': Restructure sentences for better readability.
          - 'high': Paraphrase and simplify complex ideas significantly.
          Return only the rewritten text in a JSON object: { "content": "..." }`
        },
        {
          role: "user",
          content: content,
        },
      ],
      reasoning_effort: reasoningEffort,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return { content: result.content || content };

  } catch (error) {
    console.error("Error rewriting chunk:", error);
    throw new Error("Failed to rewrite text with AI: " + (error as Error).message);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const openai = getOpenAIClient();
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
    const openai = getOpenAIClient();
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
