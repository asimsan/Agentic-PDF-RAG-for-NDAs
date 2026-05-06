import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { getEmbeddings, getBatchEmbeddings } from "./openai.js";
import { vectorStore } from "./store.js";
import { Chunk, IngestionStatus } from "./types.js";

/**
 * Robustly splits text into chunks using a hierarchy of separators
 * to maintain semantic context, with support for overlap.
 */
function recursiveSplitText(text: string, chunkSize: number = 1200, chunkOverlap: number = 150): string[] {
  const separators = ["\n\n", "\n", ". ", " ", ""];
  
  function split(content: string, separatorIdx: number): string[] {
    if (content.length <= chunkSize) return [content];
    if (separatorIdx >= separators.length) return [content];

    const sep = separators[separatorIdx];
    const parts = content.split(sep);
    const chunks: string[] = [];
    let currentChunk = "";

    for (let part of parts) {
      const potentialChunk = currentChunk ? currentChunk + sep + part : part;
      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        
        if (part.length > chunkSize) {
           const subParts = split(part, separatorIdx + 1);
           if (subParts.length > 0) {
             chunks.push(...subParts.slice(0, -1));
             currentChunk = subParts[subParts.length - 1];
           } else {
             currentChunk = "";
           }
        } else {
           currentChunk = part;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  const rawChunks = split(text, 0);
  
  // Apply overlap logic
  const chunksWithOverlap: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i];
    if (i > 0) {
      const prevChunk = rawChunks[i - 1];
      // Take the last 'chunkOverlap' characters from the previous chunk
      const overlapText = prevChunk.slice(-chunkOverlap);
      chunk = `...${overlapText} ${chunk}`;
    }
    chunksWithOverlap.push(chunk.trim());
  }

  return chunksWithOverlap.filter(c => c.length > 40);
}

export const ALL_URLS = [
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/00782839aac5f3edc5ddeaf9642d454b.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/00a1d238e37ac225b8045a97953e845d.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/00e2813f8f2f4b6d83ee26a38d4a53b3.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/013eac67e0f835473e31b3c9a69c9f1c.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/01e707f2d8b8d070d1d8ee90e8b2e7d6.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/02663ab1234ba5aec4cf370839a28eff.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/031470434423a8c40105a4b404ced88b.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/03932a530511493a189bad2241a9f193.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/03ae3b511276b560dc8806eb61b9d063.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/03efbda01358533c167ca9b1e6d72051.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/03fd0e629b617da00c54794a8a78b24d.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/04139986fd9aaf6cb0c374a67d045478.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/04a7637b57aea1b8dc83cceb7e84e964.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/04bf0791804e8487c91ab84eaa47a335.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0564e5bce70dd2df5473d64da16ddbe3.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0587275477c6ad6d0d72419383e04b88.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/05947711a24a5b7ce401911d31e19c91.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/05a8b77e5c3662f95fcf9c2c643b74db.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/05f3fedb20a022253215e295a6dd6af2.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/05f4ad5ef8f2f3998da46ad87c55e71b.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/06bb89c0b34d24024ccfba76663bac8f.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/071c4b0c3b3ba9838d0665e17ca7f15f.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/073f3b9eb0c7088be4ef688f4edfdb6d.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/07b135b30e301560ecfde236c9311975.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/084e6947bd0c4e5e287e6fa0a71b53bf.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0859334b76224ff82c1312ae7b2b5da1.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/08cc9be2c873778b05d95d03026705ca.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/08dca3b236c9f5b6b03b3e546e4daeda.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/08e3e61b099324353e2525b937a1a6f8.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0998fea954e55ef7d03d9702a5565d61.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0a42e159b33ed521c4157d8babfaf3c1.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0a68451dc19053b04342ce829bcd1321.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0b59dfc4ce9b40b0c39759dc1ade14bc.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0c3ab1d0c8bb3b1c2f7a64f3ab584368.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0c7b90701575b147c4ac245ca478ee7c.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0d3f3a02773949e285cfc3ad2fe4dbf5.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0d4e4c8a5a981d0d687abb7f43267c84.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0d84472301a851e6cd6f0e670a18b516.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0d937100a1b508979342c4469c2c6748.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0e5c76de6a864d6338d91e2a8734810d.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0ea36c66d9ecce62618e9de54216dd71.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0f32a3a54d9c1e42d26f66746821c3bf.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0f446b4ed10d8d40824270d746511cca.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/0fe8eaee697774ac95f9186dd2fc3364.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/1058cd8d541c0622ad959facd34235ea.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/10b162a253bd1e2266473c70ddeb7b05.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/116d39507d6bb61c0dec66872bd13e1c.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/119c3100a28a65ec44ecedb8a0934aa2.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/11d0a5b1f6e460c7033d57661026d00c.pdf",
  "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/12a10b807377a8be61d204d4624b034f.pdf"
];

const MOCK_NDA_TEXT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement (the "Agreement") is effective as of January 1, 2024, by and between Example Corp ("Disclosing Party") and Test Co ("Receiving Party").

1. Confidential Information
"Confidential Information" shall mean any and all technical and non-technical information provided by the Disclosing Party to the Receiving Party, including but not limited to trade secrets, software, designs, business plans, and financial information.

2. Obligations of Receiving Party
The Receiving Party agrees to hold and maintain the Confidential Information in strict confidence for the sole and exclusive benefit of the Disclosing Party. 
The obligations of confidentiality set forth in this Section shall not apply to information that is or becomes part of the public domain through no fault of the Receiving Party.

3. Term and Termination
This Agreement shall remain in effect for a period of three (3) years from the Effective Date, unless earlier terminated by either party upon thirty (30) days written notice.

4. Governing Law
This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without giving effect to its conflict of laws principles.
`;

let currentStatus: IngestionStatus = {
  totalDocs: 0,
  processedDocs: 0,
  chunks: 0,
  status: 'idle'
};

export const getIngestionStatus = () => currentStatus;

export async function ingestDocuments(urls: string[] = ALL_URLS) {
  currentStatus = {
    totalDocs: urls.length,
    processedDocs: 0,
    chunks: 0,
    status: 'ingesting'
  };

  try {
    for (const url of urls) {
      console.log(`Processing ${url}...`);
      let pages: string[] = [];
      let docId = url.split('/').pop() || 'unknown';
      
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        
        // pdf-parse usage for page-by-page extraction
        const capturedPages: string[] = [];
        const data = await pdf(Buffer.from(buffer), {
          pagerender: (pageData: any) => {
            return pageData.getTextContent().then((textContent: any) => {
              const pageText = textContent.items.map((item: any) => item.str).join(" ");
              capturedPages.push(pageText);
              return pageText;
            });
          }
        });

        pages = capturedPages;
        if (pages.length === 0) {
          // Fallback if pagerender didn't populate for some reason
          pages = data.text.split(/\f/).filter(p => p.trim().length > 0);
          if (pages.length <= 1) pages = [data.text];
        }
      } catch (err) {
        console.warn(`Failed to fetch PDF, falling back to mock NDA data: ${err}`);
        pages = [MOCK_NDA_TEXT];
        docId = 'Mock_NDA_001.pdf';
      }

      const newChunks: Chunk[] = [];
      let chunkCounter = 0;

      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageText = pages[pIdx];
        const pageNum = pIdx + 1;
        
        // Use the new Recursive Splitter instead of simple paragraph split
        const chunksForPage = recursiveSplitText(pageText, 1200, 150);

        const batchSize = 30; // Processing embeddings in batches
        for (let b = 0; b < chunksForPage.length; b += batchSize) {
          const batch = chunksForPage.slice(b, b + batchSize);
          const batchTexts = batch.map(p => p.trim());

          try {
            const embeddings = await getBatchEmbeddings(batchTexts);
            for (let i = 0; i < batch.length; i++) {
              newChunks.push({
                chunk_id: `${docId}_p${pageNum}_c${chunkCounter++}`,
                document_id: docId,
                page: pageNum,
                text: batchTexts[i],
                metadata: { url },
                embedding: embeddings[i]
              });
            }
          } catch (embedError) {
            console.error(`Embedding failed for ${docId} page ${pageNum}:`, embedError);
            throw embedError;
          }
          await new Promise(r => setTimeout(r, 200)); // Throttling
        }
      }

      vectorStore.addChunks(newChunks);
      currentStatus.processedDocs++;
      currentStatus.chunks += newChunks.length;
    }
    currentStatus.status = 'complete';
  } catch (error) {
    console.error("Ingestion failed:", error);
    if (error instanceof Error) console.error("Stack:", error.stack);
    currentStatus.status = 'error';
    currentStatus.error = error instanceof Error ? error.message : String(error);
  }
}
