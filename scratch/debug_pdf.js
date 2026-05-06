import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function debug() {
  const url = "https://raw.githubusercontent.com/applicaai/kleister-nda/master/documents/00e2813f8f2f4b6d83ee26a38d4a53b3.pdf";
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  
  let capturedPages = [];
  const data = await pdf(Buffer.from(buffer), {
    pagerender: (pageData) => {
      return pageData.getTextContent().then((textContent) => {
        const text = textContent.items.map((item) => item.str).join(" ");
        capturedPages.push(text);
        return text;
      });
    }
  });
  
  console.log("Captured Pages length:", capturedPages.length);
  console.log("Page count from metadata:", data.numpages);
  
  // Wait a bit just in case it's async
  await new Promise(r => setTimeout(r, 1000));
  console.log("Captured Pages length (after delay):", capturedPages.length);
}

debug().catch(console.error);
