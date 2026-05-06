// Using global fetch
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const baseUrl = 'http://localhost:3000/api/rag';

  console.log('--- TEST 1: Grounded Query ---');
  const res1 = await fetch(`${baseUrl}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'What is the effective date of the agreement?' })
  });
  const answer1 = await res1.json();
  
  console.log('Confidence:', answer1.confidence);
  console.log('Trace Details:');
  answer1.self_correction.forEach(s => console.log(`  - ${s.action}: ${s.result}`));
  
  const hasValidationStep = answer1.self_correction.some(s => s.action === 'validate_answer');
  console.log('Has validate_answer step:', hasValidationStep);

  console.log('\n--- TEST 2: Hallucination-Prone Query ---');
  const res2 = await fetch(`${baseUrl}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'What is the recipe for chocolate chip cookies mentioned in the agreement?' })
  });
  const answer2 = await res2.json();
  
  console.log('Confidence:', answer2.confidence);
  console.log('Answer:', answer2.answer.slice(0, 100) + '...');
  console.log('Trace Actions:', answer2.self_correction.map(s => s.action));
}

test().catch(console.error);
