import * as dotenv from 'dotenv';
dotenv.config();
import { app, askQuestion } from "./src/lib/rag/agent.ts";
import { vectorStore } from "./src/lib/rag/store.ts";

async function run() {
  vectorStore.addChunks([
    { chunk_id: "doc1_c1", document_id: "doc1", page: 1, text: "foo", metadata: {}, embedding: [0.1, 0.2] },
    { chunk_id: "doc2_c1", document_id: "doc2", page: 1, text: "bar", metadata: {}, embedding: [0.1, 0.2] }
  ]);
  
  console.log("Vector store size:", vectorStore.getChunks().length);
  const answer = await askQuestion("test", 2, "doc1");
  console.log("Answer trace:", JSON.stringify(answer.self_correction, null, 2));
}

run().catch(console.error);
