import { pipeline, AutoTokenizer, AutoModel } from '@xenova/transformers';

class LocalAIService {
  private transcriber: any;
  private embeddingPipeline: any;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Initialize the audio transcription pipeline (Whisper)
    this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');

    // Initialize the embedding pipeline (Sentence Transformers)
    this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (!this.transcriber) {
      await this.initialize();
    }
    const audioData = new Float32Array(audioBuffer.buffer);
    const output = await this.transcriber(audioData);
    return output.text;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingPipeline) {
      await this.initialize();
    }
    const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embeddingPipeline) {
      await this.initialize();
    }
    const outputs = await this.embeddingPipeline(texts, { pooling: 'mean', normalize: true });

    // The output from the batch pipeline needs to be sliced into individual embeddings
    const embeddings: number[][] = [];
    const embeddingSize = outputs.dims[1];
    for (let i = 0; i < outputs.dims[0]; i++) {
        embeddings.push(Array.from(outputs.data.slice(i * embeddingSize, (i + 1) * embeddingSize)));
    }

    return embeddings;
  }
}

export const localAIService = new LocalAIService();
