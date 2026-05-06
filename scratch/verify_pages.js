// Using built-in fetch
async function test() {
  const baseUrl = 'http://localhost:3000/api/rag';
  
  console.log('Fetching documents...');
  const docsRes = await fetch(`${baseUrl}/documents`);
  const docs = await docsRes.json();
  
  if (docs.length === 0) {
    console.log('No documents found. Please ingest some first.');
    return;
  }
  
  const sampleDoc = docs.sort((a, b) => b.chunks - a.chunks)[0];
  console.log(`Checking page numbers for document: ${sampleDoc.id}`);
  
  const chunksRes = await fetch(`${baseUrl}/chunks?documentId=${encodeURIComponent(sampleDoc.id)}`);
  const chunks = await chunksRes.json();
  
  const pages = new Set(chunks.map(c => c.page));
  console.log(`Found chunks across ${pages.size} pages: ${Array.from(pages).join(', ')}`);
  
  if (pages.size > 1) {
    console.log('PASSED: Multi-page tracking confirmed.');
  } else if (sampleDoc.chunks > 20) {
    console.log('WARNING: Only 1 page found for a document with many chunks. This might be a single-page PDF or splitting failed.');
  } else {
    console.log('INFO: Only 1 page found, but document is small.');
  }
}

test().catch(console.error);
