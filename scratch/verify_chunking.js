async function test() {
  const baseUrl = 'http://localhost:3000/api/rag';
  
  console.log('Fetching chunks for a sample document...');
  const docsRes = await fetch(`${baseUrl}/documents`);
  const docs = await docsRes.json();
  const sampleDoc = docs.find(d => d.chunks > 2) || docs[0];
  
  const chunksRes = await fetch(`${baseUrl}/chunks?documentId=${encodeURIComponent(sampleDoc.id)}`);
  const chunks = await chunksRes.json();
  
  console.log(`Analyzing ${chunks.length} chunks for ${sampleDoc.id}`);
  
  let overlapFound = 0;
  let maxLen = 0;
  
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i-1].text;
    const curr = chunks[i].text;
    
    // The overlap logic adds "..." prefix. Let's check for that.
    if (curr.startsWith('...')) {
      overlapFound++;
    }
    
    if (curr.length > maxLen) maxLen = curr.length;
  }
  
  console.log(`Max chunk length: ${maxLen}`);
  console.log(`Chunks with overlap marker: ${overlapFound}/${chunks.length - 1}`);
  
  if (overlapFound > 0 && maxLen <= 1500) {
    console.log('PASSED: Enhanced chunking verified.');
  } else {
    console.log('FAILED: Overlap markers not found or chunks too large.');
  }
}

test().catch(console.error);
