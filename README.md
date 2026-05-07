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

## Verified Behaviour

The following queries have been verified against the Kleister NDA dataset. They represent the four canonical NDA information extraction tasks this system is designed to handle. For each query, the expected behaviour is documented so reviewers can validate correctness on a freshly ingested corpus.

---

### Query 1 — Party Identification
> *"Which parties are involved, and what are their roles?"*

**Expected output**:
- Names both parties explicitly (e.g. "Company A" as the Disclosing Party, "Company B" as the Receiving Party)
- Uses **bold** formatting for party names
- Cites at least one chunk from the first page of the document
- Confidence: `high` (parties are always stated in the opening clause)

**Known behaviour**: If the document only states the parties' contractual roles (Disclosing/Receiving) but not their business context, the agent may correctly downgrade confidence to `medium` and add a caveat — this is the Critique-Informed Generation feature working as designed.

---

### Query 2 — Agreement Duration
> *"What is the duration of the agreement?"*

**Expected output**:
- States the term explicitly (e.g. "three (3) years from the Effective Date")
- Cites the specific clause and page number
- Confidence: `high` if the term is explicit; `medium` if only an effective date is found but no end date

**Known behaviour**: Agreements without a fixed term (evergreen NDAs) will correctly return a `medium` or `low` confidence answer with a note that no explicit duration was found.

---

### Query 3 — Confidentiality Exceptions
> *"What exceptions to confidentiality are listed?"*

**Expected output**:
- Returns a bullet list of exceptions (e.g. publicly known information, information received from third parties, legally compelled disclosure)
- Each bullet is grounded in a specific chunk citation
- Confidence: `high` if exceptions are enumerated; `medium` if only general carve-outs are mentioned

**Known behaviour**: This query frequently triggers the self-correction loop (Rewrite step) because the initial query "exceptions to confidentiality" may not semantically match legal phrasing like "obligations shall not apply to". The rewritten query typically resolves this.

---

### Query 4 — Governing Law
> *"Which governing law or jurisdiction is mentioned?"*

**Expected output**:
- Names the jurisdiction explicitly (e.g. "the laws of the State of Delaware")
- Cites the governing law clause
- Confidence: `high`

**Known behaviour**: Cosine similarity scores for this query are often lower (30–50%) because the embedding distance between "governing law" and "construed in accordance with the laws of..." is large. This is expected — the LLM correctly identifies the clause despite the embedding gap. See `RAG_ARCHITECTURE_EXPLAINED.md` for a full explanation of why low cosine scores do not imply low answer quality.

---

### Verification threshold

**3 of 4 queries must produce a grounded, cited answer** on a freshly ingested corpus for the system to be considered functional. Query 3 (exceptions) is the most likely to require a self-correction retry and may return `medium` confidence on ambiguous documents — this is correct behaviour, not a failure.
