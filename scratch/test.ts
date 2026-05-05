import { fileURLToPath } from 'url';
console.log('import.meta.url:', import.meta.url);
try {
  console.log('fileURLToPath:', fileURLToPath(import.meta.url));
} catch (e) {
  console.error('Error in fileURLToPath:', e);
}
