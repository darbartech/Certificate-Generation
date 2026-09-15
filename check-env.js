const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

const envPath = path.join(process.cwd(), '.env');
const env = loadEnvFile(envPath);

const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
const url = env.SUPABASE_URL || '';

console.log('Reading from:', envPath);
console.log('SUPABASE_URL:', JSON.stringify(url));
console.log('SUPABASE_SERVICE_ROLE_KEY length:', key.length);
console.log('Key prefix (first 15 chars):', JSON.stringify(key.slice(0, 15)));
console.log('Key suffix (last 6 chars):', JSON.stringify(key.slice(-6)));
console.log('Has leading/trailing whitespace?', key !== key.trim());
console.log('Contains any spaces inside?', /\s/.test(key));