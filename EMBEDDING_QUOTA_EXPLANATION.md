# Embedding Quota Issue & Resolution

## The Problem
When ingesting multiple documents, the application was originally configured to process text chunks one by one. For each chunk (paragraph), it made a separate API call to Google Gemini's embedding model (`gemini-embedding-2`). 

Because documents can contain dozens or hundreds of chunks, processing just a few documents quickly triggered the following error:
`Quota exceeded for metric: generativelanguage.googleapis.com/embed_content_free_tier_requests, limit: 100, model: gemini-embedding-2`

The Gemini API free tier strictly limits embedding requests to **100 Requests Per Minute (RPM)**. 

## The Solution
To stay well within the generous free tier limits while still processing documents efficiently, we implemented two key changes:

### 1. Batch Embeddings (`batchEmbedContents`)
Instead of embedding chunks individually via `embedContent`, we updated `src/lib/rag/gemini.ts` to utilize the `batchEmbedContents` method. This allows us to pack multiple text chunks (we chose a batch size of 100) into a **single** API request. 

By doing this, a document with 100 paragraphs now consumes only **1 request** towards our rate limit instead of 100.

### 2. Throttling Between Batches
Even with batching, processing a large number of documents concurrently or in rapid succession might still approach the 100 RPM limit. To add an extra layer of safety, we introduced an artificial delay in `src/lib/rag/ingestion.ts`:
```typescript
// Throttling: Wait 2 seconds between batches to avoid 100 RPM free tier limits
await new Promise(r => setTimeout(r, 2000));
```

## Summary
By combining **Batching** (drastically reducing the total number of API calls) with **Throttling** (pacing the remaining calls), the ingestion pipeline is now smooth, scalable, and completely resilient against free-tier quota exhaustion.
