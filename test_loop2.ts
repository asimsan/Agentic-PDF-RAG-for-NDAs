import * as dotenv from 'dotenv';
dotenv.config();
import { app, askQuestion } from "./src/lib/rag/agent.ts";
import { vectorStore } from "./src/lib/rag/store.ts";

async function run() {
  vectorStore.addChunks([
    { chunk_id: "doc1_c1", document_id: "doc1", page: 1, text: "foo", metadata: {}, embedding: [0.1, 0.2] },
    { chunk_id: "doc2_c1", document_id: "doc2", page: 1, text: "bar", metadata: {}, embedding: [0.1, 0.2] }
  ]);
  
  const initialState = {
    question: "test loop",
    documentId: "doc1",
    queries: ["test loop"],
    maxRetries: 3,
    attempts: 0,
    chunks: [],
    trace: []
  };

  const finalState = await app.invoke(initialState);
  console.log("Trace length:", finalState.trace.length);
  finalState.trace.forEach((t: any) => console.log(t.step, t.action, t.result));
}

run().catch(console.error);
