import { Router } from 'express'
import { User } from '../models/User.js'
import { comparePassword, signToken, requireAuth } from '../utils/auth.js'

const router = Router()

const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' })
  const user = await User.findOne({ email: email.toLowerCase() })
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const token = signToken({ sub: user._id.toString(), email: user.email, role: user.role })
  res.cookie('admin_token', token, cookieOpts())
  res.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } })
})

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', { path: '/', sameSite: cookieOpts().sameSite, secure: cookieOpts().secure })
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email, role: req.user.role })
})

export default router
