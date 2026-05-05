# Agentic NDA RAG System

An intelligent PDF retrieval and reasoning system specialized for NDA (Non-Disclosure Agreement) documents. Built with **GPT-5.4 Mini** and **LangGraph** for high-fidelity extraction and self-correcting retrieval.

## Tech Stack & Core Packages

- **Frontend**: React 19, Vite, Tailwind CSS (v4), Motion (Framer Motion).
- **Backend**: Express, Node.js (via `tsx`).
- **Orchestration**: LangGraph (`@langchain/langgraph`) for agentic control flow.
- **AI Models**:
  - **LLM**: `gpt-5.4-mini` (OpenAI).
  - **Embeddings**: `text-embedding-3-small` (OpenAI).
- **Parsing**: `pdf-parse` for PDF text extraction.
- **Icons**: Lucide React.

## Architecture Overview

The system follows a modular architecture:
1.  **Ingestion & Chunking**: Fetches NDA PDFs from the Kleister NDA dataset. Parses text using `pdf-parse` and splits it into semantic chunks (paragraphs).
2.  **Semantic Indexing**: Chunks are embedded using OpenAI's `text-embedding-3-small` and stored in a simple in-memory vector store.
3.  **Agentic Loop (LangGraph)**:
    -   **Retrieve**: Scans the vector store for semantic matches.
    -   **Validate**: An LLM judge evaluates if the current context is sufficient to answer the user's question.
    -   **Rewrite**: If context is weak, the agent rewrites the query to catch missing nuances (e.g., legal synonyms).
    -   **Answer**: Generates a grounded response with specific citations.
4.  **UI Dashboard**: A clean, Perplexity-style interface for asking questions, viewing stats, and inspecting the agent's chain of thought (Correction Trace).

## Design Decisions & Trade-offs

-   **LangGraph for Control Flow**: Used to make the "Self-Correction" behavior explicit and auditable. Unlike a simple loop, this graph structure allows for complex state management and easy debugging of retry steps.
-   **Recursive Paragraph Chunking**: NDAs are clause-heavy. Splitting by paragraphs preserves the context of specific legal terms better than fixed-size token splitting.
-   **Zero-Trust Grounding**: The system is instructed to refrain from answering if no supporting evidence is found, and confidence levels are explicitly calculated.

## Self-Correction Strategy

The system performs a **multi-pass loop**:
1.  **Initial Retrieval**: Finds the top relevant chunks.
2.  **Sufficiency Check**: The LLM analyzes the chunks. If they don't explicitly contain enough information (e.g., missing specific dates), it identifies the gap.
3.  **Query Decomposition**: The agent generates a new, targeted query to find the missing information.
4.  **Context Merging**: New results are added to previous ones, and the agent tries again (up to 2 retries).

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Environment Setup
Create a `.env` file in the root directory and add your API keys:
```env
OPENAI_API_KEY=your_openai_api_key
# Optional: GEMINI_API_KEY=your_gemini_api_key
```

### 3. Installation
```bash
npm install
```

### 4. Start Development Server
This will start both the Vite frontend and the Express backend concurrently:
```bash
npm run dev
```

### 5. Usage
1. Open the UI (usually `http://localhost:5173`).
2. Click **"Trigger Sample Ingestion"** in the sidebar to load and index the NDA documents.
3. Once the status shows **"READY"**, type your question in the search bar.
4. Watch the **"Correction Trace"** in the sidebar to see the agent's reasoning process.

## Example Queries

- "Which parties are involved, and what are their roles?"
- "What is the duration of the agreement?"
- "What exceptions to confidentiality are listed?"
- "Which governing law or jurisdiction is mentioned?"
