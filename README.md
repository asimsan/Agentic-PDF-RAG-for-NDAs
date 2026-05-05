# Agentic NDA RAG System

An intelligent PDF retrieval and reasoning system specialized for NDA (Non-Disclosure Agreement) documents. Built with GPT-5.4 Mini and LangGraph for high-fidelity extraction and self-correcting retrieval.

## Architecture Overview

The system follows a modular architecture:
1.  **Ingestion & Chunking**: Fetches NDA PDFs from the Kleister NDA dataset. Parses text and splits it into semantic chunks (paragraphs).
2.  **Semantic Indexing**: Chunks are embedded using `gemini-embedding-2` and stored in a vector store.
3.  **Agentic Loop (LangGraph)**:
    -   **Retrieve**: Scans the vector store for semantic matches.
    -   **Validate**: An LLM judge evaluates if the current context is sufficient to answer the user's question.
    -   **Rewrite**: If context is weak, the agent rewrites the query to catch missing nuances (e.g., legal synonyms).
    -   **Answer**: Generates a grounded response with specific citations.
4.  **UI Dashboard**: A "Bold Typography" styled interface for asking questions, viewing stats, and inspecting the agent's chain of thought (Correction Trace).

## Design Decisions & Trade-offs

-   **LangGraph for Control Flow**: Used to make the "Self-Correction" behavior explicit and auditable. Unlike a simple loop, this graph structure allows for complex state management and easy debugging of retry steps.
-   **Recursive Paragraph Chunking**: NDAs are clause-heavy. Splitting by paragraphs preserves the context of specific legal terms better than fixed-size token splitting.
-   **Zero-Trust Grounding**: The system is instructed to refrain from answering if no supporting evidence is found, and confidence levels are explicitly calculated.

## Self-Correction Strategy

The system doesn't just search once. It performs a **multi-pass loop**:
1.  Initial Retrieval.
2.  **Sufficiency Check**: The LLM analyzes the chunks. If they don't explicitly mention the "terminating party" for a termination question, it identifies this gap.
3.  **Query Decomposition**: The agent generates a new query like "who can terminate the agreement" instead of just "termination clause".
4.  **Context Merging**: New results are added to previous ones, and the agent tries again up to a maximum of 2 retries.

## Acceptance Criteria

-   **Grounding**: Every answer must map back to at least one unique `chunk_id`.
-   **Traceability**: The UI must display every step taken (Retrieve, Validate, Rewrite).
-   **Robustness**: System must handle PDF parsing failures gracefully and provide an "incomplete" status.
-   **Performance**: End-to-end question answering under 10 seconds.

## Example Queries

-   "Which parties are involved, and what are their roles?"
-   "What is the duration of the agreement?"
-   "What exceptions to confidentiality are listed?"
-   "Which governing law or jurisdiction is mentioned?"

## Setup Instructions

1.  Provide your `OPENAI_API_KEY` in the secrets/environment.
2.  Run `npm run dev` to start the server.
3.  Click "Trigger Sample Ingestion" in the UI to load documents into the memory store.
4.  Ask questions!
