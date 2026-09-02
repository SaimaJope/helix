// Usage: node hash-password.mjs <username> "<Full name>" <password>
// Prints a JSON user entry for the USERS secret.
import { webcrypto as crypto } from 'node:crypto';

const [username, name, password] = process.argv.slice(2);
if (!username || !name || !password) {
  console.error('Usage: node hash-password.mjs <username> "<Full name>" <password>');
  process.exit(1);
}
const enc = new TextEncoder();
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iterations = 120000;
const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
console.log(JSON.stringify({ username: username.toLowerCase(), name, hash: `pbkdf2$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}` }));
