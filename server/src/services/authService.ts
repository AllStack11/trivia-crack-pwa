import type { AccountSummary, AuthResponse, RegisterRequest } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 210_000;
const encoder = new TextEncoder();

export class RegistrationError extends Error {
  constructor(message: string, readonly status: 400 | 409) {
    super(message);
    this.name = 'RegistrationError';
  }
}


interface AccountRow {
  user_id: string;
  email: string;
  password_hash: string;
  username: string;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function digest(value: string): Promise<string> {
  return encodeBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256
  ));
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(bits)}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, expectedText] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || iterations < 1 || !saltText || !expectedText) return false;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const actual = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: decodeBase64(saltText), iterations }, key, 256
    ));
    const expected = decodeBase64(expectedText);
    let difference = actual.length ^ expected.length;
    for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
      difference |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
    }
    return difference === 0;
  } catch {
    return false;
  }
}

async function createSession(db: AppDatabase, userId: string, now = Date.now()): Promise<string> {
  const token = encodeBase64(crypto.getRandomValues(new Uint8Array(32)));
  await db.execute(
    'INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [await digest(token), userId, now + SESSION_TTL_MS, now]
  );
  return token;
}

export async function register(db: AppDatabase, input: RegisterRequest): Promise<AuthResponse> {
  const request = input && typeof input === 'object' ? input : ({} as RegisterRequest);
  const username = typeof request.username === 'string' ? request.username.trim() : '';
  const email = typeof request.email === 'string' ? request.email.trim() : '';
  const password = typeof request.password === 'string' ? request.password : '';
  if (!username || username.length > 24) throw new RegistrationError('Username must be 1–24 characters', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RegistrationError('Enter a valid email address', 400);
  if (password.length < 8) throw new RegistrationError('Password must be at least 8 characters', 400);
  const normalizedEmail = email.toLowerCase();
  const normalizedUsername = username.toLowerCase();
  const id = `account_${crypto.randomUUID()}`;
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  try {
    await db.batch([
      { sql: 'INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)', params: [id, username, now] },
      { sql: 'INSERT INTO accounts (user_id, email, normalized_email, normalized_username, password_hash) VALUES (?, ?, ?, ?, ?)', params: [id, email, normalizedEmail, normalizedUsername, passwordHash] }
    ]);
  } catch (error) {
    const existingEmail = await db.queryFirst('SELECT user_id FROM accounts WHERE normalized_email = ?', [normalizedEmail]);
    if (existingEmail) throw new RegistrationError('An account with that email already exists', 409);
    const existingUsername = await db.queryFirst('SELECT user_id FROM accounts WHERE normalized_username = ?', [normalizedUsername]);
    if (existingUsername) throw new RegistrationError('That username is already taken', 409);
    throw error;
  }
  return { account: { id, username }, token: await createSession(db, id, now) };
}

export async function login(db: AppDatabase, email: string, password: string): Promise<AuthResponse> {
  if (typeof email !== 'string' || typeof password !== 'string') throw new Error('Email and password are required');
  const account = await db.queryFirst<AccountRow>(
    `SELECT a.user_id, a.email, a.password_hash, u.username
     FROM accounts a JOIN users u ON u.id = a.user_id WHERE a.normalized_email = ?`,
    [email.trim().toLowerCase()]
  );
  if (!account || !(await verifyPassword(password, account.password_hash))) throw new Error('Invalid email or password');
  return { account: { id: account.user_id, username: account.username }, token: await createSession(db, account.user_id) };
}

export async function getSession(db: AppDatabase, token: string | undefined, now = Date.now()): Promise<AccountSummary | null> {
  if (!token) return null;
  const account = await db.queryFirst<AccountRow & { expires_at: number; token_hash: string }>(
    `SELECT a.user_id, a.email, a.password_hash, u.username, s.expires_at, s.token_hash
     FROM auth_sessions s JOIN accounts a ON a.user_id = s.user_id JOIN users u ON u.id = a.user_id
     WHERE s.token_hash = ?`,
    [await digest(token)]
  );
  if (!account) return null;
  if (account.expires_at <= now) {
    await db.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [account.token_hash]);
    return null;
  }
  return { id: account.user_id, username: account.username };
}

export async function logout(db: AppDatabase, token: string | undefined): Promise<void> {
  if (token) await db.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [await digest(token)]);
}

export async function listPlayers(db: AppDatabase, userId: string): Promise<AccountSummary[]> {
  return db.query<AccountSummary>(
    `SELECT u.id, u.username FROM users u JOIN accounts a ON a.user_id = u.id
     WHERE u.id != ? ORDER BY a.normalized_username, u.id`, [userId]
  );
}
