import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { getEmbeddings, getModel } from "./gemini.js";
import { vectorStore } from "./store.js";
import { AnswerPayload, RetrievedChunk, TraceStep, ValidationResult } from "./types.js";

// Define the state
const AgentState = Annotation.Root({
  question: Annotation<string>(),
  queries: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  chunks: Annotation<RetrievedChunk[]>({ reducer: (a, b) => {
    const existingIds = new Set(a.map(c => c.chunk_id));
    return [...a, ...b.filter(c => !existingIds.has(c.chunk_id))];
  }, default: () => [] }),
  lastValidation: Annotation<ValidationResult | null>({ reducer: (_, b) => b, default: () => null }),
  attempts: Annotation<number>({ reducer: (a, b) => a + (b || 1), default: () => 0 }),
  maxRetries: Annotation<number>(),
  trace: Annotation<TraceStep[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  answer: Annotation<AnswerPayload | null>({ reducer: (_, b) => b, default: () => null }),
});

// Nodes
const retrieveNode = async (state: typeof AgentState.State) => {
  const query = state.queries[state.queries.length - 1];
  const embedding = await getEmbeddings(query);
  const results = await vectorStore.search(embedding);
  
  const step: TraceStep = {
    step: state.trace.length + 1,
    action: "retrieve",
    input: query,
    result: `Found ${results.length} chunks`
  };

  return { chunks: results, trace: [step], attempts: 1 };
};

const validateNode = async (state: typeof AgentState.State) => {
  const model = getModel();
  const context = state.chunks.map(c => `[${c.chunk_id}]: ${c.text}`).join("\n\n");
  
  const prompt = `You are a judge for a RAG system. 
Analyze the provided document chunks and decide if they contain sufficient information to answer the user's question accurately.
If not, identify what is missing.

Question: ${state.question}

Chunks:
${context}

Respond in JSON format:
{
  "sufficient": boolean,
  "missing_info": "description of what is missing if sufficient is false",
  "reasoning": "your reasoning"
}`;

  const result = await model.generateContent(prompt);
  const jsonStr = result.response.text().replace(/```json|```/g, "").trim();
  const validation: ValidationResult = JSON.parse(jsonStr);

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

  const result = await model.generateContent(prompt);
  const rewrittenQuery = result.response.text().trim();

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
  
  const prompt = `Answer the user's question using ONLY the provided document chunks. 
Cite your sources by including the chunk_id in brackets like [doc_c1].
Distinguish between directly supported facts, reasonable inferences, and missing information.

Question: ${state.question}

Chunks:
${context}

Respond in JSON format:
{
  "answer": "your grounded answer here",
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

  const result = await model.generateContent(prompt);
  const jsonStr = result.response.text().replace(/```json|```/g, "").trim();
  const rawAnswer = JSON.parse(jsonStr);

  const finalAnswer: AnswerPayload = {
    ...rawAnswer,
    self_correction: state.trace
  };

  return { answer: finalAnswer };
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
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "validate")
  .addConditionalEdges("validate", afterValidate)
  .addEdge("rewrite", "retrieve")
  .addEdge("generate_answer", END);

export const app = workflow.compile();

export async function askQuestion(question: string, maxRetries: number = 2) {
  const initialState = {
    question,
    queries: [question],
    maxRetries,
    attempts: 0,
    chunks: [],
    trace: []
  };

  const finalState = await app.invoke(initialState);
  return finalState.answer;
}
