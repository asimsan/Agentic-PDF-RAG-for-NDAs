# Process Map Gap Analysis

I have compared our current implementation against the 10-step plan provided. While we have the core agentic loop working well, there are several technical gaps where the implementation can be matured to match the full plan.

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
