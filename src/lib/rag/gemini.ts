import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

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

export const getEmbeddings = async (text: string) => {
  const model = getGenAI().getGenerativeModel({ model: "gemini-embedding-2" });
  const result = await model.embedContent(text);
  return result.embedding.values;
};

export const getBatchEmbeddings = async (texts: string[]) => {
  const model = getGenAI().getGenerativeModel({ model: "gemini-embedding-2" });
  const requests = texts.map((text) => ({ content: { parts: [{ text }] } }));
  const result = await model.batchEmbedContents({ requests });
  return result.embeddings.map((emb) => emb.values);
};

export const getModel = (modelName: string = "gemini-2.0-flash") => {
  return getGenAI().getGenerativeModel({ model: modelName });
};
