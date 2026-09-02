// Usage: node hash-password.mjs <username> "<Full name>" <password> [--totp]
// Prints a JSON user entry for the USERS secret. With --totp it also prints an
// authenticator setup key: the login then needs a 6-digit code as well.
import { webcrypto as crypto } from 'node:crypto';

const args = process.argv.slice(2);
const wantTotp = args.includes('--totp');
const [username, name, password] = args.filter((a) => a !== '--totp');
if (!username || !name || !password) {
  console.error('Usage: node hash-password.mjs <username> "<Full name>" <password> [--totp]');
  process.exit(1);
}
if (password.length < 12) { console.error('Use a password of at least 12 characters (a sentence works well).'); process.exit(1); }
const enc = new TextEncoder();
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iterations = 100000; // Cloudflare Workers cap PBKDF2 at 100000 iterations
const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
const entry = { username: username.toLowerCase(), name, hash: `pbkdf2$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}` };
if (wantTotp) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const raw = crypto.getRandomValues(new Uint8Array(20));
  let bitsStr = ''; for (const b of raw) bitsStr += b.toString(2).padStart(8, '0');
  let secret = ''; for (let i = 0; i + 5 <= bitsStr.length; i += 5) secret += A[parseInt(bitsStr.slice(i, i + 5), 2)];
  entry.totp = secret;
  const label = encodeURIComponent('Helix Anthropis:' + entry.username);
  console.error(`\nAuthenticator setup for ${entry.username}:\n  Key (enter manually in Google Authenticator, Authy, 1Password, etc.): ${secret}\n  Or paste this URL into a QR generator and scan it:\n  otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Helix Anthropis')}&digits=6&period=30\n`);
}
console.log(JSON.stringify(entry));
