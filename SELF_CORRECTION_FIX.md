# Agentic RAG Self-Correction Fix

## The Issue
An inconsistency was observed in the Agentic RAG pipeline where the self-correction loop would mark retrieved chunks as **Insufficient**, even when they contained the correct answer. However, when the exact rewritten query from the trace was used directly in the chat, the system marked it as **Sufficient** and provided a high-confidence answer.

### Root Cause Analysis
The issue was traced to the state management in the LangGraph agent (`src/lib/rag/agent.ts`). 

1. **Static Validation Context**: In the `validateNode`, the LLM judge was evaluating retrieved chunks against `state.question`, which remains the **original user input** throughout the loop.
2. **Semantic Gap**: If the original question is vague (e.g., "what are the named entities ?"), the judge becomes overly strict, even if the rewritten query (e.g., "Identify named entities including organizations, individuals, and locations...") successfully retrieves the right data.
3. **Mismatched Success Criteria**: The system was retrieving data for the *new* query but judging success against the *old* question.

## The Resolution
We updated the `validateNode` and `answerNode` to use the **latest query** from the `queries` array instead of the static original question.

### Changes made in `src/lib/rag/agent.ts`:

#### Before:
```typescript
const validateNode = async (state: typeof AgentState.State) => {
  // ...
  const prompt = `...
Question: ${state.question}
...`;
}

const answerNode = async (state: typeof AgentState.State) => {
  // ...
  const prompt = `...
Question: ${state.question}
...`;
}
```

#### After:
```typescript
const validateNode = async (state: typeof AgentState.State) => {
  // ...
  const prompt = `...
Question: ${state.queries[state.queries.length - 1]}
...`;
}

const answerNode = async (state: typeof AgentState.State) => {
  // ...
  const prompt = `...
Question: ${state.queries[state.queries.length - 1]}
...`;
}
```

## Impact
This change ensures that the agent's internal evaluation is aligned with its retrieval strategy. By judging chunks against the refined, more specific rewritten query, the "Insufficient" false negatives are eliminated, leading to faster convergence and higher confidence scores.
