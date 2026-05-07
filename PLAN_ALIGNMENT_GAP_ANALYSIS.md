# Plan Alignment Gap Analysis

Comparison of the original 10-step plan against the current implementation state. This document is kept up-to-date as gaps are resolved.

*Last updated: May 2026*

---

## Technical Alignment Summary

| Step | Plan Feature | Current Status | Alignment |
| :--- | :--- | :--- | :--- |
| **1** | PDF Parsing & OCR | `pdf-parse` with `pagerender` hook | ✅ Matched (no OCR needed for Kleister dataset) |
| **2** | Chunking & Overlap | Recursive splitter, 1200 chars, 150-char overlap | ✅ Matched |
| **3** | Page Tracking | Per-page extraction via `pagerender`, chunk tagged with `page` number | ✅ Matched |
| **4** | Query + Doc ID | `question` + `documentId` both supported | ✅ Matched |
| **5** | Filtered Retrieval | `vectorStore.search(embedding, 8, documentId)` | ✅ Matched |
| **6** | Validation #1 | `validateNode` — LLM judge with sufficiency check | ✅ Matched |
| **7** | Self-Correction | `rewriteNode` + retry loop via LangGraph conditional edges | ✅ Matched |
| **8** | Grounded Answer | `answerNode` with critique-informed generation and inline citations | ✅ Matched |
| **9** | Validation #2 | Dedicated `validateAnswerNode` — hallucination check against source chunks | ✅ Matched |
| **10** | Trace & Evidence | Full trace in sidebar + cosine-scored evidence cards | ✅ Matched |

---

## Resolved Gaps (Previously Flagged)

### ✅ Page Tracking (Steps 1 & 3) — RESOLVED
- **Was**: `page` field hardcoded to `1`
- **Now**: `ingestion.ts` uses `pdf-parse`'s `pagerender` hook to process the PDF page-by-page. Each chunk is tagged with its exact page number, enabling accurate citations (e.g. "Page 4").

### ✅ Chunking Strategy (Step 2) — RESOLVED
- **Was**: Simple paragraph-based splitting, no overlap
- **Now**: `recursiveSplitText()` implements a hierarchical separator strategy (`\n\n` → `\n` → `. ` → ` `) with 1,200-char chunks and 150-char overlap. Chunks under 40 chars are discarded.

### ✅ Second-Pass Validation / Hallucination Check (Step 9) — RESOLVED
- **Was**: Validation #2 handled implicitly via generation prompt instructions
- **Now**: Dedicated `validateAnswerNode` in `agent.ts` runs a post-generation fact-check. It compares every claim in the answer against the source chunks and downgrades confidence to `low` + adds a warning banner if hallucinations are detected.

---

## New Capabilities (Beyond Original Plan)

These were added during implementation and exceed the original specification:

| Feature | Description |
| :--- | :--- |
| **Critique-Informed Generation** | Validation #1's `missing_info` is injected into the answer prompt, preventing false-confident answers when evidence is incomplete |
| **safeParseJSON** | All three LLM JSON parse points are wrapped in error-safe fallbacks — the agent never crashes from malformed LLM output |
| **Cosine Score Surfacing** | Evidence cards show the exact cosine similarity score for each retrieved chunk, colour-coded (green/yellow/grey) |
| **Conversation Threads** | Multi-thread UI with per-thread document scoping and message-level trace inspection |
| **Acceptance Criteria** | Formal product (P1–P7) and engineering (E1–E8) criteria defined in `ACCEPTANCE_CRITERIA.md` |

---

## Remaining Limitations

These are honest gaps relative to a production-grade legal RAG system — not blockers for the current scope:

| Limitation | Impact | Mitigation |
| :--- | :--- | :--- |
| **No OCR support** | Scanned/image-based NDAs cannot be parsed | Kleister dataset uses text-based PDFs — not a practical issue for this corpus |
| **In-memory vector store** | Data lost on server restart; does not scale beyond ~5K chunks | Acceptable for demo; production would use Pinecone, Weaviate, or pgvector |
| **No persistent storage** | Ingested documents must be re-loaded on restart | By design for simplicity; a Redis or SQLite cache would solve this |
| **Single LLM provider** | Fully coupled to OpenAI (`gpt-5.4-mini` + `text-embedding-3-small`) | Provider abstraction exists in `openai.ts` — swapping is one file change |
| **No authentication** | API is open on `localhost:3000` | Not applicable for a local dev tool; would need auth for any deployment |


## Technical Alignment Summary

| Step | Plan Feature | Current Status | Alignment |
| :--- | :--- | :--- | :--- |
| **1** | PDF Parsing & OCR | Parsing only | ⚠️ Partial (No OCR) |
| **2** | Chunking & Overlap | Basic split | ⚠️ Partial (No Overlap) |
| **3** | Page Tracking | Hardcoded to 1 | ❌ Missing |
| **4** | Query + Doc ID | Fully supported | ✅ Matched |
| **5** | Filtered Retrieval | Fully supported | ✅ Matched |
| **6** | Validation #1 | Judge LLM node | ✅ Matched |
| **7** | Self-Correction | Rewrite + Retry | ✅ Matched |
| **8** | Grounded Answer | Prompt-enforced | ✅ Matched |
| **9** | Validation #2 | Part of Generation | ⚠️ Partial (Not separate) |
| **10** | Trace & Evidence | Comprehensive | ✅ Matched |

---

## Detailed Gaps & Recommendations

### 1. Page Tracking & OCR (Steps 1 & 3)
*   **Current**: `pdf-parse` is used for basic text extraction, but we aren't tracking which page a specific chunk belongs to. The `page` field is currently hardcoded to `1`.
*   **Recommendation**: Refactor `ingestion.ts` to process the PDF page-by-page. If OCR is required for scanned NDAs, we should integrate a service like Google Document AI or a Tesseract-based local wrapper.

### 2. Chunking Strategy (Step 2)
*   **Current**: Simple paragraph-based splitting.
*   **Recommendation**: Implement a recursive character text splitter with **overlap** (e.g., 500-1000 chars with 10% overlap). This prevents semantic meaning from being cut off at chunk boundaries.

### 3. Second-Pass Validation (Step 9)
*   **Current**: We ask the LLM to validate the *retrieved chunks* (Validation #1) and then generate the answer. The "Validation #2" (checking if the generated answer is grounded) is currently handled via instructions in the generation prompt.
*   **Recommendation**: To fully match the plan, we should add a dedicated `validate_answer` node in `agent.ts`. This node would run a "Hallucination Check" to ensure every claim in the answer is backed by a specific chunk ID before the answer is sent to the user.

---

## Next Steps
Would you like me to prioritize fixing the **Page Tracking** issue (making citations accurate) or implementing the **Validation #2** step for higher reliability?
