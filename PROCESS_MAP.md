# Overall Process Map: Agentic PDF RAG

The following diagram illustrates the end-to-end flow of the system, divided into two primary phases: **Ingestion** (data preparation) and **Reasoning** (the agentic search loop).

```mermaid
graph TD
    subgraph Ingestion_Phase ["Phase 1: Knowledge Base Ingestion"]
        A[NDA PDF URLs] --> B[PDF Parsing]
        B --> C[Text Chunking]
        C --> D[OpenAI Embeddings]
        D --> E[(Simple Vector Store)]
    end

    subgraph Reasoning_Phase ["Phase 2: Agentic Query Loop"]
        F[User Question] --> G[Retrieve Chunks]
        E -.-> G
        G --> H{Validate Info?}
        H -- Insufficient & < Max Retries --> I[Rewrite Query]
        I --> G
        H -- Sufficient OR Max Retries --> J[Generate Grounded Answer]
        J --> K[UI Response]
    end

    style Ingestion_Phase fill:#f5f7ff,stroke:#3b82f6,stroke-width:2px
    style Reasoning_Phase fill:#fffaf5,stroke:#f97316,stroke-width:2px
    style E fill:#e5e7eb,stroke:#374151
    style K fill:#dcfce7,stroke:#16a34a
```

---

## Phase 1: Ingestion (Backend)
This phase happens once (or when triggered) to prepare the data.
1.  **PDF Parsing**: The system fetches PDFs from URLs and converts them to raw text.
2.  **Chunking**: Text is broken into paragraphs to maintain semantic meaning.
3.  **Embedding**: Each chunk is sent to OpenAI to generate a 1536-dimensional vector.
4.  **Storage**: Vectors and text are stored in the local `SimpleVectorStore`.

## Phase 2: Reasoning (Agentic Loop)
This phase happens every time a user asks a question.
1.  **Retrieve**: The agent pulls the top 8 most similar chunks from the store.
2.  **Validate**: A "Judge" LLM reviews the chunks to see if they actually answer the specific question.
3.  **Rewrite**: If the judge finds the info lacking, it identifies the "missing piece" and rewrites the query to find it.
4.  **Generate**: Once the agent is satisfied (or gives up), it synthesizes the final answer using only the verified evidence.
5.  **UI Response**: The final answer is displayed along with a "Correction Trace" showing the agent's internal thought process.
