import { db } from '../db/db'
import type { User } from '../db/types'

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

/** PBKDF2-SHA256 with 100k iterations. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(bits)
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  const hash = await hashPassword(password, user.salt)
  return hash === user.passwordHash
}

export async function createUser(input: {
  username: string
  password: string
  displayName?: string
  role?: User['role']
}): Promise<number> {
  const username = input.username.trim().toLowerCase()
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error('Username must be 3-32 characters: letters, numbers, dot, dash or underscore.')
  }
  if (input.password.length < 6) throw new Error('Password must be at least 6 characters.')
  const existing = await db.users.where('username').equals(username).first()
  if (existing) throw new Error('That username is already taken.')
  const salt = randomSalt()
  const passwordHash = await hashPassword(input.password, salt)
  const id = await db.users.add({
    username,
    displayName: input.displayName?.trim() || username,
    role: input.role ?? 'user',
    passwordHash,
    salt,
    createdAt: Date.now(),
  })
  return id as number
}

export async function setPassword(userId: number, password: string): Promise<void> {
  if (password.length < 6) throw new Error('Password must be at least 6 characters.')
  const salt = randomSalt()
  const passwordHash = await hashPassword(password, salt)
  await db.users.update(userId, { salt, passwordHash })
}

export async function login(username: string, password: string): Promise<User> {
  const user = await db.users.where('username').equals(username.trim().toLowerCase()).first()
  if (!user) throw new Error('Invalid username or password.')
  if (user.disabled) throw new Error('This account has been disabled.')
  const ok = await verifyPassword(user, password)
  if (!ok) throw new Error('Invalid username or password.')
  return user
}
