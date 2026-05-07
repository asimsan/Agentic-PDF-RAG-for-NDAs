# Agentic PDF RAG: Core Architecture Explained

This document provides a detailed breakdown of the four primary components that power the Agentic PDF RAG system.

---

## 1. `ingestion.ts` - The Data Pipeline
The **Ingestion Engine** is responsible for transforming raw PDF documents into a structured, searchable format.

### Key Functions:
- **PDF Extraction**: Uses `pdf-parse` with a `pagerender` hook to extract text **page-by-page**. Each chunk is tagged with its exact page number, enabling accurate source citations (e.g., "Page 4") in the final answer.
- **Smart Chunking (Recursive Character Text Splitter)**: Splits large documents into smaller, semantically coherent chunks using a hierarchical strategy:
  - **Chunk Size**: 1,200 characters — large enough for meaningful context, small enough for precision retrieval.
  - **Chunk Overlap**: 150 characters (~12.5%) — each chunk is prepended with the tail of the previous chunk to prevent losing context at boundaries.
  - **Separator Hierarchy**: The splitter tries progressively narrower separators in order: `\n\n` (paragraph) → `\n` (line) → `. ` (sentence) → ` ` (word). This ensures chunks break at the most logical point possible.
  - **Quality Filter**: Chunks shorter than 40 characters are discarded to eliminate noise (e.g., lone headers or page numbers).
  - **Result**: A typical multi-page NDA produces ~28 high-quality overlapping chunks instead of ~7 large blobs, giving the vector search significantly greater precision.
- **Batch Embedding**: Converts text chunks into numerical vectors using OpenAI's `text-embedding-3-small` model. Handled in **batches of 30**, followed by a 200ms throttle delay between each batch. The batch size of 30 was chosen as a deliberate middle ground:
  - **Not lower (e.g. 5–10)**: Smaller batches increase the number of API round-trips and slow down total ingestion. Since a typical NDA page produces ~5–10 chunks, a batch of 30 usually processes an entire page in a single API call.
  - **Not higher (e.g. 100+)**: While the API technically supports up to 2,048 inputs per request, larger batches increase the token payload and the blast radius of a failure — a single failed batch loses more work.
  - **Sweet spot**: 30 chunks × ~1,200 chars ≈ ~9,000 tokens per batch — well within OpenAI's token limits, reliably safe on free-tier and low-quota accounts, and small enough that failures are cheap to retry.
- **Status Tracking**: Maintains a real-time `IngestionStatus` object, allowing the UI to show progress (e.g., "10/20 documents processed").

---

## 2. `store.ts` - The Vector Memory
The **Vector Store** is the system's "brain" for retrieving information. While simple, it implements the core logic of a vector database.

### Key Features:
- **In-Memory Storage**: Chunks are stored in a simple array, making the system extremely fast for development and small-to-medium corpora.
- **Cosine Similarity**: Implements a mathematical similarity function to compare the "meaning" (embeddings) of the user's question against all stored document chunks. Every chunk is scored and sorted highest-to-lowest before the top 8 are returned.
- **Filtered Search**: Supports scoped searching, allowing the agent to look for information within the entire corpus or limit its search to a specific document.

### Understanding the Cosine Score (and Why Low ≠ Bad)
The cosine score shown on each source card in the UI is a **query-to-chunk distance**, not a quality rating. This distinction matters:

- **What it measures**: How closely aligned the *embedding vector* of the chunk is to the *embedding vector* of the query. A score of 0.33 means the wording of the chunk is moderately different from the wording of the question — **not** that the chunk is unhelpful.
- **Why legal text scores low**: You might ask *"who are the parties?"* but the NDA says *"entered into by and between Company A ('Disclosing Party') and Company B..."*. The answer is there — but the phrasing is so different that the embedding distance is large.
- **The LLM outperforms the embedding**: The `validate` and `answer` nodes use a full language model that can reason across paraphrasing and legal synonyms. Cosine similarity is a fixed vector comparison — it misses nuance that the LLM catches easily.

### Two Independent Scoring Systems

| Signal | Set by | Measures |
|---|---|---|
| **Cosine score (e.g. 33%)** | Vector math in `store.ts` | Embedding distance between query and chunk |
| **Confidence (high/medium/low)** | LLM in `agent.ts` | Whether the chunk *semantically* answers the question |

These two signals are completely decoupled. A high-confidence answer with a 33% cosine score is normal and valid — it means the LLM successfully extracted a correct answer from the best available chunks, even though those chunks were lexically distant from the query. Use cosine scores as a **relative ranking** between chunks for a single query, not as an absolute threshold for answer quality.

---

## 3. `openai.ts` - The AI Interface
This file acts as the **Abstraction Layer** for all AI interactions, centralizing the configuration and execution of LLM and embedding tasks.

### Responsibilities:
- **Client Management**: Lazily initializes the OpenAI client using the `OPENAI_API_KEY` from the server environment.
- **Embedding Generation**: Provides utility functions (`getEmbeddings`, `getBatchEmbeddings`) used during both ingestion and retrieval.
- **Model Orchestration**: Standardizes the chat completion interface through the `generate` function, allowing the rest of the system to interact with models like `gpt-4o-mini` without worrying about API specifics.

---

## 4. `agent.ts` - The Orchestrator
The **Agent** is the most complex component, utilizing `LangGraph` to implement a sophisticated self-correcting RAG loop.

### The Agentic Workflow:
Instead of a simple "Search & Answer" approach, this agent follows a multi-step logic:

1.  **Retrieve**: Searches the vector store for the **top 8 chunks** most semantically similar to the current query. New chunks from each retry pass are deduplicated and merged into the accumulated context, so across all passes (up to 2 retries) the agent can work with up to **24 unique chunks** in total.
2.  **Validate**: A "Judge" model analyzes the retrieved chunks to decide if they actually contain enough information to answer the question.
3.  **Rewrite (Self-Correction)**: If information is missing, the agent identifies what's missing and rewrites the user's question into a more effective search query, then loops back to **Retrieve**.
4.  **Generate Answer**: Once sufficient information is found (or retries are exhausted), a final model generates a grounded response, citing specific chunks as evidence.

### Why this is "Agentic":
Unlike standard RAG, this agent has **agency**—it can reason about its own retrieval quality and decide to try again with a better strategy if the first attempt fails.
