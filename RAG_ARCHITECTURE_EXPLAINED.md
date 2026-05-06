# Agentic PDF RAG: Core Architecture Explained

This document provides a detailed breakdown of the four primary components that power the Agentic PDF RAG system.

---

## 1. `ingestion.ts` - The Data Pipeline
The **Ingestion Engine** is responsible for transforming raw PDF documents into a structured, searchable format.

### Key Functions:
- **PDF Extraction**: Uses `pdf-parse` to download and extract text from a list of predefined NDA URLs.
- **Smart Chunking**: Splits large documents into smaller, manageable paragraphs. This ensures that the context provided to the AI is focused and relevant.
- **Batch Embedding**: Converts text chunks into numerical vectors using OpenAI's `text-embedding-3-small` model. It handles this in batches to optimize performance and respect API rate limits.
- **Status Tracking**: Maintains a real-time `IngestionStatus` object, allowing the UI to show progress (e.g., "10/20 documents processed").

---

## 2. `store.ts` - The Vector Memory
The **Vector Store** is the system's "brain" for retrieving information. While simple, it implements the core logic of a vector database.

### Key Features:
- **In-Memory Storage**: Chunks are stored in a simple array, making the system extremely fast for development and small-to-medium corpora.
- **Cosine Similarity**: Implements a mathematical similarity function to compare the "meaning" (embeddings) of the user's question against all stored document chunks.
- **Filtered Search**: Supports scoped searching, allowing the agent to look for information within the entire corpus or limit its search to a specific document.

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

1.  **Retrieve**: Searches the vector store for chunks relevant to the user's question.
2.  **Validate**: A "Judge" model analyzes the retrieved chunks to decide if they actually contain enough information to answer the question.
3.  **Rewrite (Self-Correction)**: If information is missing, the agent identifies what's missing and rewrites the user's question into a more effective search query, then loops back to **Retrieve**.
4.  **Generate Answer**: Once sufficient information is found (or retries are exhausted), a final model generates a grounded response, citing specific chunks as evidence.

### Why this is "Agentic":
Unlike standard RAG, this agent has **agency**—it can reason about its own retrieval quality and decide to try again with a better strategy if the first attempt fails.
