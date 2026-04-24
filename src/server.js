import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'

import { connectMongo } from './utils/db.js'
import { seedIfEmpty } from './utils/seed.js'

import authRoutes from './routes/auth.js'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'

const app = express()

// Trust proxy so secure-cookie detection + req.ip work behind Vercel
app.set('trust proxy', 1)

// ─── CORS — allow frontend origins + credentials ─────────────────────────
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server / curl (no Origin header)
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

// ─── Ensure Mongo connected before handling API traffic ──────────────────
let seeded = false
app.use(async (_req, _res, next) => {
  try {
    await connectMongo()
    if (!seeded) {
      seeded = true
      seedIfEmpty().catch((e) => console.error('[seed]', e))
    }
    next()
  } catch (err) {
    next(err)
  }
})

app.get('/', (_req, res) => {
  res.json({
    name: 'portfolio-api',
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      auth: '/api/auth/{login,logout,me}',
      public: '/api/public/{hero,about,experience,skills,projects,testimonials,contact,track}',
      admin: '/api/admin/…',
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/admin', adminRoutes)

// ─── 404 + error handlers ────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal error' })
})

const PORT = process.env.PORT || 4000
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`)
  })
}

export default app
