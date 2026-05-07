# Acceptance Criteria — Agentic PDF RAG for NDAs

This document defines what "good enough" means for this implementation from both a **product** and **engineering** perspective. These criteria are derived from a full analysis of the codebase and the design decisions documented across the project's markdown files.

---

## How to Read This Document

Each criterion has:
- A **what** (the observable behaviour)
- A **why** (why it matters for this system)
- A **threshold** (the line between pass and fail)

---

## Part 1: Product Acceptance Criteria

These define what a real user of the system would consider "working correctly."

---

### P1 — Document Ingestion

**What**: The system can ingest NDA PDFs from the Kleister dataset and report live progress.

**Why**: Ingestion is the prerequisite for everything. If it fails silently, the system answers from nothing.

| Criterion | Pass | Fail |
|---|---|---|
| Ingestion can be triggered via the UI slider (20–50 docs) | ✅ Status transitions `idle → ingesting → complete` | ❌ Status stays `idle` or flips to `error` |
| Per-document progress is visible | ✅ UI shows "X/Y documents processed" | ❌ No feedback until completion |
| Failed PDF fetch falls back to mock NDA | ✅ `Mock_NDA_001.pdf` appears in corpus | ❌ Ingestion crashes entirely |
| Chunk count is non-zero after ingestion | ✅ ≥ 1 chunk per document (typically ~28) | ❌ 0 chunks indexed |
| Duplicate ingestion runs do not corrupt the store | ✅ Chunks are additive; queries still work | ❌ Duplicate chunk IDs or store corruption |

---

### P2 — Query Answering (Core NDA Questions)

**What**: The system correctly answers the four canonical NDA query types.

**Why**: These are the documented example queries and represent the primary use case.

| Query type | Pass | Fail |
|---|---|---|
| "Which parties are involved?" | ✅ Names both parties; cites chunk | ❌ Hallucinated names or no citation |
| "What is the duration of the agreement?" | ✅ States term (e.g. "3 years"); cites page | ❌ Guesses or says "not found" when it is present |
| "What exceptions to confidentiality are listed?" | ✅ Lists clauses; uses bullet formatting | ❌ Generic answer not grounded in the document |
| "Which governing law is mentioned?" | ✅ Names jurisdiction (e.g. "State of Delaware") | ❌ Wrong jurisdiction or no answer |

**Threshold**: 3 of 4 queries must produce a grounded, cited answer on a freshly ingested corpus.

---

### P3 — Confidence Calibration

**What**: The confidence badge (`high`/`medium`/`low`) is honest and consistent with the actual answer quality.

**Why**: This is a legal application. A falsely confident answer is dangerous. The Critique-Informed Generation feature was built specifically to prevent this.

| Situation | Expected confidence | Fail condition |
|---|---|---|
| All key facts are present and cited | `high` | `low` shown when answer is fully grounded |
| Validation flagged missing info, retries exhausted | `medium` or `low` | `high` shown despite known gaps |
| `safeParseJSON` fallback triggered | `low` (answerNode fallback) | `high` shown after a parse failure |
| Fact-check node detects hallucination | `low` + warning banner | `high` or `medium` shown |

---

### P4 — Self-Correction Trace

**What**: The Correction Trace sidebar shows the agent's actual reasoning steps and is useful for auditing.

**Why**: The agentic loop is the core differentiator of this system. The trace makes it auditable and explainable.

| Criterion | Pass | Fail |
|---|---|---|
| Every query shows at least a `retrieve` and `validate` step | ✅ Steps appear in sidebar | ❌ Sidebar shows "Waiting for execution..." after response |
| A rewrite step appears when validation fails | ✅ Orange dot + "New query: ..." shown | ❌ Rewrite happens but trace is silent |
| Trace updates correctly when switching between messages | ✅ Clicking a previous message loads its trace | ❌ Trace always shows only the latest message |

---

### P5 — Source Evidence with Scores

**What**: The Sources tab shows ranked evidence cards with cosine similarity scores.

**Why**: Transparency about where the answer came from, and how strong each source match was, is essential for trust in legal contexts.

| Criterion | Pass | Fail |
|---|---|---|
| Evidence cards show chunk ID, document name, page, and snippet | ✅ All four fields populated | ❌ Any field blank or `undefined` |
| Cosine score badge appears on each card | ✅ Score shown as e.g. "33%" in correct colour | ❌ No badge or badge shows `NaN%` |
| Score colour coding is correct | ✅ ≥80% green, ≥60% yellow, below grey | ❌ All grey, or colour mismatched |
| Evidence count in tab badge matches actual cards | ✅ "Sources (3)" shows 3 cards | ❌ Count and cards disagree |

---

### P6 — Document Filtering

**What**: Selecting a specific document in the thread scopes all retrieval to that document only.

**Why**: When a user selects "Search: doc_abc.pdf", cross-document contamination would produce wrong answers.

| Criterion | Pass | Fail |
|---|---|---|
| All evidence `document` fields match the selected doc ID | ✅ Only chunks from the selected document appear | ❌ Chunks from other documents appear in evidence |
| Query with no match in the selected doc returns low-confidence answer, not cross-corpus answer | ✅ "Insufficient evidence" caveat in answer | ❌ Silently answers from another document |

---

### P7 — Conversation Threads

**What**: Multiple threads can exist in parallel; each maintains its own question/answer history.

| Criterion | Pass | Fail |
|---|---|---|
| New threads start with empty message list | ✅ Search bar is blank; no previous messages shown | ❌ Previous messages bleed into new thread |
| Thread name updates to first question | ✅ Thread renamed from "New Conversation" after first query | ❌ Thread always shows "New Conversation" |
| Threads can be deleted without crashing | ✅ Thread removed; active thread switches correctly | ❌ Deletion causes blank screen or error |

---

## Part 2: Engineering Acceptance Criteria

These define what the codebase must guarantee at the implementation level, independent of what the user sees.

---

### E1 — Resilience: No Crashes from LLM JSON Errors

**What**: The agent never throws an unhandled `SyntaxError` from `JSON.parse` on any LLM response.

**Why**: The `validateAnswerNode` crash (`SyntaxError: Expected ',' or '}'`) was a live production failure that killed entire agent runs. The `safeParseJSON` helper was introduced to prevent this.

| Criterion | Pass | Fail |
|---|---|---|
| Malformed JSON from `validateNode` → fallback `{ sufficient: true }` | ✅ Agent continues to answer | ❌ Unhandled exception, 500 response |
| Malformed JSON from `answerNode` → fallback low-confidence message | ✅ UI shows error message with `low` confidence | ❌ Crash, blank UI |
| Malformed JSON from `validateAnswerNode` → fallback `{ grounded: true }` | ✅ Answer passes fact-check silently | ❌ Crash, 500 response |
| `[safeParseJSON]` warning appears in server logs on fallback | ✅ Warning logged with first 200 chars of raw response | ❌ Silent failure with no trace |

---

### E2 — Chunk Deduplication Across Retries

**What**: When the agent retries with a rewritten query, chunks already retrieved in the first pass are not duplicated in the context.

**Why**: Without deduplication, the LLM prompt grows unboundedly across retries, wasting tokens and risking context window limits.

| Criterion | Pass | Fail |
|---|---|---|
| `chunk_id` set is used to deduplicate across retry passes | ✅ `existingIds` Set in AgentState reducer prevents duplicates | ❌ Same chunk appears twice in `state.chunks` |
| Max context across 2 retries is bounded at ~24 unique chunks | ✅ `chunks.length ≤ 24` in final state | ❌ `chunks.length > 24` (dedup failed) |

---

### E3 — Chunking Quality

**What**: The ingestion pipeline produces high-quality, correctly-sized chunks with no noise.

| Criterion | Pass | Fail |
|---|---|---|
| No chunk shorter than 40 characters reaches the vector store | ✅ Quality filter applied in `recursiveSplitText` | ❌ Single-word or header-only chunks in store |
| Chunks include 150-char overlap from the previous chunk | ✅ Chunk text starts with `...` + tail of previous | ❌ Hard cuts with no overlap |
| Chunk size does not significantly exceed 1,200 characters | ✅ `chunkSize = 1200` enforced | ❌ Chunks of 3,000+ chars reducing retrieval precision |
| A typical NDA document produces ≥15 chunks | ✅ Higher chunk count = more granular retrieval | ❌ 1–3 chunks per doc (whole-document blobs) |

---

### E4 — Cosine Score Enrichment Integrity

**What**: The score attached to each evidence item is the real cosine similarity from `store.ts`, not fabricated.

| Criterion | Pass | Fail |
|---|---|---|
| Score is looked up from `scoreMap` keyed on `chunk_id` | ✅ Score matches actual similarity for the chunk | ❌ Score is `undefined` or `NaN` |
| Score is rounded to 2 decimal places | ✅ e.g. `0.33`, not `0.3312847...` | ❌ Full floating-point precision leaks to UI |
| Evidence items whose `chunk_id` is not in retrieved chunks show no score badge | ✅ `score: undefined` → badge not rendered | ❌ Badge shows `0%` for unmatched items |

---

### E5 — API Security

**What**: The `OPENAI_API_KEY` is never accessible to the browser.

**Why**: The API key is loaded via `dotenv` on the server. Any leak to the frontend would be a critical security vulnerability.

| Criterion | Pass | Fail |
|---|---|---|
| `OPENAI_API_KEY` is not present in any `import.meta.env.*` reference in frontend code | ✅ Key only used in `openai.ts` (server-side) | ❌ Key referenced in `App.tsx` or `vite.config.ts` |
| All AI calls are proxied through `/api/rag/ask` | ✅ Frontend only makes `fetch('/api/rag/...')` calls | ❌ Frontend calls OpenAI directly |
| `.env` is listed in `.gitignore` | ✅ Key never committed to version control | ❌ `.env` is tracked |

---

### E6 — API Contract Stability

**What**: All server endpoints return the documented shape consistently.

| Endpoint | Required response shape | Fail condition |
|---|---|---|
| `GET /api/rag/status` | `{ totalDocs, processedDocs, chunks, status, error? }` | Missing `status` field |
| `POST /api/rag/ask` | `{ answer, confidence, evidence[], self_correction[] }` | `null` or missing `evidence` |
| `GET /api/rag/documents` | `Array<{ id, chunks }>` | Empty array when corpus is loaded |
| `GET /api/rag/chunks` | Array of chunks without `embedding` field | `embedding` array included (too large for UI) |

---

### E7 — Ingestion Performance

**What**: Ingestion completes within a reasonable wall-clock time.

| Criterion | Threshold |
|---|---|
| 20 documents ingested end-to-end | ≤ 5 minutes on a stable network connection |
| Batch embedding call (30 chunks) | ≤ 3 seconds per batch |
| 200ms throttle between batches is respected | No `429 Too Many Requests` errors from OpenAI |
| Server remains responsive during ingestion | `/api/rag/status` returns within 200ms while ingesting |

---

### E8 — Validation Alignment (Self-Correction Correctness)

**What**: The `validateNode` evaluates chunks against the **latest rewritten query**, not the original question.

**Why**: This was a documented bug (`SELF_CORRECTION_FIX.md`). Judging rewritten-query results against the original question caused false "Insufficient" verdicts.

| Criterion | Pass | Fail |
|---|---|---|
| `validateNode` prompt uses `state.queries[state.queries.length - 1]` | ✅ Latest query used | ❌ `state.question` used (original, static) |
| `answerNode` prompt uses the latest query | ✅ Latest query used | ❌ Original question used in final answer generation |

---

## Summary: Minimum Viable "Good Enough"

For this implementation to be considered production-ready at its current scope, it must satisfy:

- **All P1–P7** product criteria (with P2 requiring 3/4 query types to pass)
- **E1** (no crashes) — this is a hard blocker
- **E5** (API security) — this is a hard blocker
- **E2, E3, E8** — core correctness of the agentic pipeline

**E4, E6, E7** are quality-of-life and observability criteria that should be met but are not hard blockers for a working demo.

---

*Last updated: Based on codebase state as of May 2026. Derived from analysis of `agent.ts`, `ingestion.ts`, `store.ts`, `openai.ts`, `server/routes.ts`, `App.tsx`, and supporting documentation.*
