import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }
    openaiClient = new OpenAI({ apiKey });
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

export const getModel = (modelName: string = "gpt-4o-mini") => {
  const client = getOpenAI();

  return {
    generate: async (input: string) => {
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: input }],
      });

      return response.choices[0].message.content || "";
    },
  };
};
