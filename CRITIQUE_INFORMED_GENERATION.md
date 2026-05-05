# Critique-Informed Generation Workflow

## The Problem: The Confidence Disconnect
In the initial Agentic RAG implementation, there was a structural disconnect between the **validation step** (the "Judge") and the **generation step** (the "Answerer"):

1. **`validateNode` (The Judge)**: Evaluated the retrieved chunks against the user's question. If the chunks didn't contain all necessary details (e.g., specific business roles), it marked the context as "Insufficient" and recorded what was missing (`missing_info`).
2. **`answerNode` (The Answerer)**: Generated the final answer based *only* on the raw chunks. It did not know that the Judge had failed the context.

**The Symptom:** When asked "What are their roles?", the Answerer found that the entities were the "disclosing" and "receiving" parties. Because this was explicitly stated in the text, the Answerer assigned a **"High" confidence score**, even though the Judge had correctly identified that the *specific business roles* regarding the transaction were missing.

This resulted in the UI showing an "Insufficient" validation trace alongside a "High" confidence final answer—a confusing experience that breaks trust in legal applications.

## The Solution: Critique-Informed Generation
To fix this, we implemented **Critique-Informed Generation** in `src/lib/rag/agent.ts`.

Instead of letting the Answerer operate blindly, we now pass the Judge's exact critique into the Answerer's prompt:

```typescript
  const validationNote = state.lastValidation && !state.lastValidation.sufficient 
    ? `\n\nValidation Note: The retrieval system flagged the following potential gaps in context: "${state.lastValidation.missing_info}". \nIf this missing info is crucial, caveat your answer and assign a "medium" or "low" confidence score.` 
    : "";
```

## How It Works Now
1. **Retrieve**: The system fetches chunks.
2. **Validate**: The Judge evaluates the chunks. If they are imperfect, it records `missing_info`.
3. **Rewrite/Retry Loop**: The system attempts to find better chunks.
4. **Generate (with Critique)**: If the loop exhausts its retries, the final `answerNode` runs. It reads both the chunks *and* the Judge's `missing_info`.
5. **Calibrated Confidence**: The Answerer realizes, *"I can see they are the disclosing/receiving parties, but I am missing their business roles."* Following the new prompt instructions, it outputs the partial answer but **lowers its confidence to Medium or Low** and explicitly adds a caveat to the user.

## Why This is Best for Legal RAG
In the legal domain, a confident but partially blind answer is dangerous. By bridging the gap between the validation and generation nodes, the system is now **transparent about its limitations**. It preserves helpful partial answers while eliminating false confidence, resulting in a much safer and more explainable user experience.
