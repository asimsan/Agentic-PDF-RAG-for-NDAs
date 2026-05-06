import { app, askQuestion } from "./src/lib/rag/agent.ts";
import { vectorStore } from "./src/lib/rag/store.ts";

async function run() {
  vectorStore.addChunks([
    { chunk_id: "doc1_c1", document_id: "doc1", page: 1, text: "foo", metadata: {}, embedding: [0.1, 0.2] },
    { chunk_id: "doc2_c1", document_id: "doc2", page: 1, text: "bar", metadata: {}, embedding: [0.1, 0.2] }
  ]);
  
  const chunks = await vectorStore.search([0.1, 0.2], 8, "doc1");
  console.log("direct search with doc1:", chunks.map(c => c.chunk_id));

  const chunks2 = await vectorStore.search([0.1, 0.2], 8, "");
  console.log("direct search with '':", chunks2.map(c => c.chunk_id));

  const chunks3 = await vectorStore.search([0.1, 0.2], 8, undefined);
  console.log("direct search with undefined:", chunks3.map(c => c.chunk_id));
}

run().catch(console.error);
