import { Router } from "express";
import { ingestDocuments, getIngestionStatus, ALL_URLS } from "../src/lib/rag/ingestion.js";
import { askQuestion } from "../src/lib/rag/agent.js";
import { vectorStore } from "../src/lib/rag/store.js";

export const ragRouter = Router();

ragRouter.get("/status", (req, res) => {
  res.json(getIngestionStatus());
});

ragRouter.post("/ingest", async (req, res) => {
  const { urls, sampleCount } = req.body;
  
  // Non-blocking ingestion
  if (urls && Array.isArray(urls)) {
    ingestDocuments(urls).catch(console.error);
  } else if (sampleCount && typeof sampleCount === 'number') {
    const count = Math.min(Math.max(sampleCount, 1), ALL_URLS.length);
    ingestDocuments(ALL_URLS.slice(0, count)).catch(console.error);
  } else {
    ingestDocuments().catch(console.error);
  }
  
  res.json({ message: "Ingestion started" });
});

ragRouter.post("/ask", async (req, res) => {
  const { question, maxRetries } = req.body;
  try {
    const answer = await askQuestion(question, maxRetries);
    res.json(answer);
  } catch (error) {
    console.error("Ask error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

ragRouter.get("/documents", (req, res) => {
  const chunks = vectorStore.getChunks();
  const docs = Array.from(new Set(chunks.map(c => c.document_id))).map(id => ({
    id,
    chunks: chunks.filter(c => c.document_id === id).length
  }));
  res.json(docs);
});

ragRouter.get("/chunks", (req, res) => {
  res.json(vectorStore.getChunks().slice(0, 50)); // Limit for UI
});
