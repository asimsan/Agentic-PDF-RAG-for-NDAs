import { Chunk, RetrievedChunk } from "./types.js";

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

export class SimpleVectorStore {
  private chunks: Chunk[] = [];

  addChunks(newChunks: Chunk[]) {
    this.chunks.push(...newChunks);
  }

  getChunks() {
    return this.chunks;
  }

  async search(queryEmbedding: number[], topK: number = 8, documentId?: string): Promise<RetrievedChunk[]> {
    const scored = this.chunks
      .filter(c => c.embedding && (!documentId || c.document_id === documentId))
      .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  clear() {
    this.chunks = [];
  }
}

export const vectorStore = new SimpleVectorStore();
