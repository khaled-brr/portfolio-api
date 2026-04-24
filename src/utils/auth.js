import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10)
}

export async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}

export function requireAuth(req, res, next) {
  const token =
    req.cookies?.admin_token ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
