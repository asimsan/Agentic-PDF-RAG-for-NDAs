import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { getEmbeddings, getModel } from "./openai.js";
import { vectorStore } from "./store.js";
import { AnswerPayload, RetrievedChunk, TraceStep, ValidationResult } from "./types.js";

/**
 * Robustly parses JSON from an LLM response.
 * Strips markdown code fences, extracts the outermost {...} block,
 * and returns `fallback` if parsing still fails.
 */
function safeParseJSON<T>(raw: string, fallback: T, label: string): T {
  try {
    const stripped = raw.replace(/```json|```/g, "").trim();
    // Extract outermost { ... } in case there's surrounding prose
    const match = stripped.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : stripped;
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.warn(`[safeParseJSON] Failed to parse JSON for "${label}". Using fallback. Raw:`, raw.slice(0, 200));
    return fallback;
  }
}

// Define the state
const AgentState = Annotation.Root({
  question: Annotation<string>(),
  queries: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  chunks: Annotation<RetrievedChunk[]>({
    reducer: (a, b) => {
      const existingIds = new Set(a.map(c => c.chunk_id));
      return [...a, ...b.filter(c => !existingIds.has(c.chunk_id))];
    }, default: () => []
  }),
  lastValidation: Annotation<ValidationResult | null>({ reducer: (_, b) => b, default: () => null }),
  attempts: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
  maxRetries: Annotation<number>(),
  documentId: Annotation<string | undefined>({ reducer: (_, b) => b, default: () => undefined }),
  trace: Annotation<TraceStep[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  answer: Annotation<AnswerPayload | null>({ reducer: (_, b) => b, default: () => null }),
});

// Nodes
const retrieveNode = async (state: typeof AgentState.State) => {
  const query = state.queries[state.queries.length - 1];
  const embedding = await getEmbeddings(query);
  const results = await vectorStore.search(embedding, 8, state.documentId);

  const step: TraceStep = {
    step: state.trace.length + 1,
    action: "retrieve",
    input: query,
    result: `Found ${results.length} chunks` + (state.documentId ? ` in doc ${state.documentId}` : "")
  };

  return { chunks: results, trace: [step], attempts: 1 };
};

const validateNode = async (state: typeof AgentState.State) => {
  const model = getModel();
  const context = state.chunks.map(c => `[${c.chunk_id}]: ${c.text}`).join("\n\n");

  const prompt = `You are a judge for a RAG system. 
Analyze the provided document chunks and decide if they contain sufficient information to answer the user's question accurately.
If not, identify what is missing.

Question: ${state.queries[state.queries.length - 1]}

Chunks:
${context}

Respond in JSON format:
{
  "sufficient": boolean,
  "missing_info": "description of what is missing if sufficient is false",
  "reasoning": "your reasoning"
}`;

  const responseText = await model.generate(prompt);
  const validation: ValidationResult = safeParseJSON<ValidationResult>(
    responseText,
    { sufficient: true, missing_info: "", reasoning: "JSON parse error — assuming sufficient" },
    "validateNode"
  );

  const step: TraceStep = {
    step: state.trace.length + 1,
    action: "validate",
    output: validation,
    result: validation.sufficient ? "Sufficient" : "Insufficient"
  };

  return { lastValidation: validation, trace: [step] };
};

const rewriteNode = async (state: typeof AgentState.State) => {
  const model = getModel();
  const prompt = `The initial retrieval for the question "${state.question}" was insufficient.
Missing information: ${state.lastValidation?.missing_info}

Rewrite the original question into a more effective search query that might find the missing information in NDA documents.
NDA documents often use specific legal terminology.

Respond with JUST the rewritten query.`;

  const rewrittenQuery = await model.generate(prompt);

  const step: TraceStep = {
    step: state.trace.length + 1,
    action: "rewrite",
    input: state.lastValidation?.missing_info,
    output: rewrittenQuery,
    result: "Query rewritten"
  };

  return { queries: [rewrittenQuery], trace: [step] };
};

const answerNode = async (state: typeof AgentState.State) => {
  const model = getModel();
  const context = state.chunks.map(c => `[${c.chunk_id}] (Doc: ${c.document_id}): ${c.text}`).join("\n\n");

  const validationNote = state.lastValidation && !state.lastValidation.sufficient
    ? `\n\nValidation Note: The retrieval system flagged the following potential gaps in context: "${state.lastValidation.missing_info}". \nIf this missing info is crucial, caveat your answer and assign a "medium" or "low" confidence score.`
    : "";

  const prompt = `Answer the user's question using the provided document chunks. 
Use Markdown for formatting:
- Use **bold** for key terms and party names.
- Use bullet points for lists.
- Use # or ## for clear section headers.
- Cite your sources by including the chunk_id in brackets like [doc_c1] IMMEDIATELY after the sentence it supports.

Distinguish between directly supported facts, reasonable inferences, and missing information.${validationNote}

Question: ${state.queries[state.queries.length - 1]}

Chunks:
${context}

Respond in JSON format:
{
  "answer": "your markdown grounded answer here",
  "confidence": "high" | "medium" | "low",
  "evidence": [
    {
      "document": "doc_id",
      "page": 1,
      "chunk_id": "chunk_id",
      "snippet": "short exact snippet from text"
    }
  ]
}`;

  const responseText = await model.generate(prompt);
  const rawAnswer = safeParseJSON<any>(
    responseText,
    { answer: "The agent could not parse a structured answer from the model response.", confidence: "low", evidence: [] },
    "answerNode"
  );

  // Enrich evidence with cosine similarity scores from retrieved chunks
  const scoreMap = new Map(state.chunks.map(c => [c.chunk_id, (c as any).score as number]));
  const enrichedEvidence = (rawAnswer.evidence || []).map((ev: any) => ({
    ...ev,
    score: scoreMap.has(ev.chunk_id) ? Math.round(scoreMap.get(ev.chunk_id)! * 100) / 100 : undefined
  }));

  const finalAnswer: AnswerPayload = {
    ...rawAnswer,
    evidence: enrichedEvidence,
    self_correction: state.trace
  };

  return { answer: finalAnswer };
};

const validateAnswerNode = async (state: typeof AgentState.State) => {
  console.log("--- Executing validate_answer node ---");
  if (!state.answer) {
    console.error("validate_answer called with no answer in state");
    return { trace: [] };
  }
  const model = getModel();
  const context = state.chunks.map(c => `[${c.chunk_id}]: ${c.text}`).join("\n\n");
  const answer = state.answer.answer;
  const prompt = `You are a professional fact-checker for a RAG system.
Review the generated answer against the source chunks.

Rules:
1. "Directly supported facts" MUST match the chunks or be close paraphrases.
2. "Reasonable inferences" ARE ALLOWED if they are logical deductions from the provided text.
3. "Hallucinations" are claims that FLATLY CONTRADICT the chunks or introduce major external knowledge not found in the documents.

Answer: ${answer}

Chunks:
${context}

Respond in JSON format:
{
  "grounded": boolean, // Set to false ONLY if there is a flat contradiction or major external hallucination.
  "issues": "description of any hallucinations",
  "reasoning": "your reasoning"
}`;

  const responseText = await model.generate(prompt);
  const validation = safeParseJSON<{ grounded: boolean; issues: string; reasoning: string }>(
    responseText,
    { grounded: true, issues: "", reasoning: "JSON parse error — assuming grounded" },
    "validateAnswerNode"
  );

  const step: TraceStep = {
    step: state.trace.length + 1,
    action: "validate_answer",
    output: validation,
    result: validation.grounded ? "Fully Grounded" : "Hallucination Detected"
  };

  let updatedAnswer = state.answer;
  if (!validation.grounded && updatedAnswer) {
    updatedAnswer = {
      ...updatedAnswer,
      confidence: "low",
      answer: `[FACT-CHECK WARNING: Some claims may not be fully grounded] \n\n ${updatedAnswer.answer}`,
      self_correction: [...updatedAnswer.self_correction, step]
    };
  } else if (updatedAnswer) {
    updatedAnswer = {
      ...updatedAnswer,
      self_correction: [...updatedAnswer.self_correction, step]
    };
  }

  console.log("--- validate_answer grounding result:", validation.grounded);

  return { answer: updatedAnswer, trace: [step] };
};

// Define the flow
const afterValidate = (state: typeof AgentState.State) => {
  if (state.lastValidation?.sufficient) return "generate_answer";
  if (state.attempts >= state.maxRetries) return "generate_answer";
  return "rewrite";
};

const workflow = new StateGraph(AgentState)
  .addNode("retrieve", retrieveNode)
  .addNode("validate", validateNode)
  .addNode("rewrite", rewriteNode)
  .addNode("generate_answer", answerNode)
  .addNode("validate_answer", validateAnswerNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "validate")
  .addConditionalEdges("validate", afterValidate)
  .addEdge("rewrite", "retrieve")
  .addEdge("generate_answer", "validate_answer")
  .addEdge("validate_answer", END);

export const app = workflow.compile();

export async function askQuestion(question: string, maxRetries: number = 2, documentId?: string) {
  const initialState = {
    question,
    documentId,
    queries: [question],
    maxRetries,
    attempts: 0,
    chunks: [],
    trace: []
  };

  const finalState = await app.invoke(initialState);
  return finalState.answer;
}
