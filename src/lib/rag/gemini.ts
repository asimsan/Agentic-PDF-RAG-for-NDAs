import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

let genAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEYS environment variable not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getOpenAI() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }
    openaiClient = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }
  return openaiClient;
}

export const getEmbeddings = async (text: string) => {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
};

export const getBatchEmbeddings = async (texts: string[]) => {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((emb) => emb.embedding);
};

export const getModel = (modelName: string = "gpt-5.4-mini") => {
  const client = getOpenAI();

  return {
    generate: (input: string) =>
      client.responses.create({
        model: modelName,
        input,
      }),
  };
};
