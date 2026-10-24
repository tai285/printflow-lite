import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64

/** Hashes a password with scrypt and a random salt: "scrypt$<salt>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltText, keyText] = stored.split('$')
  if (scheme !== 'scrypt' || !saltText || !keyText) return false
  const expected = Buffer.from(keyText, 'base64')
  const actual = await scryptAsync(
    password,
    Buffer.from(saltText, 'base64'),
    expected.length,
  )
  return timingSafeEqual(actual, expected)
}

/**
 * Hash of a throwaway password. Login checks it when the email is unknown so
 * "no such user" and "wrong password" take the same time.
 */
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'))
