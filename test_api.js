const http = require('http');

const data = JSON.stringify({
  question: 'test question',
  maxRetries: 2,
  documentId: 'doc1'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/rag/ask',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
