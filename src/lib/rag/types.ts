export interface Chunk {
  chunk_id: string;
  document_id: string;
  page: number;
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface RetrievedChunk extends Chunk {
  score: number;
}

export interface ValidationResult {
  sufficient: boolean;
  missing_info: string;
  reasoning: string;
}

export interface TraceStep {
  step: number;
  action: string;
  input?: any;
  output?: any;
  result: string;
}

export interface AnswerPayload {
  answer: string;
  confidence: "high" | "medium" | "low";
  evidence: {
    document: string;
    page: number;
    chunk_id: string;
    snippet: string;
  }[];
  self_correction: TraceStep[];
}

export interface IngestionStatus {
  totalDocs: number;
  processedDocs: number;
  chunks: number;
  status: 'idle' | 'ingesting' | 'complete' | 'error';
  error?: string;
}
