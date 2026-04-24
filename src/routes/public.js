import { Router } from 'express'
import { Hero } from '../models/Hero.js'
import { About } from '../models/About.js'
import { Experience } from '../models/Experience.js'
import { SkillCategory } from '../models/SkillCategory.js'
import { Project } from '../models/Project.js'
import { Testimonial } from '../models/Testimonial.js'
import { Contact } from '../models/Contact.js'
import { Message } from '../models/Message.js'
import { PageView } from '../models/Analytics.js'

const router = Router()

router.get('/hero', async (_req, res) => {
  const doc = await Hero.findOne({ singleton: 'hero' }).lean()
  if (!doc) return res.json(null)
  res.json({
    name: { first: doc.firstName, last: doc.lastName },
    role: doc.role,
    tagline: doc.tagline,
    stats: doc.stats,
    availability: doc.availability,
    cvUrl: doc.cvUrl,
  })
})

router.get('/about', async (_req, res) => {
  const doc = await About.findOne({ singleton: 'about' }).lean()
  if (!doc) return res.json(null)
  res.json({
    intro: doc.intro,
    businessIntro: doc.businessIntro,
    impactMetrics: doc.impactMetrics,
    values: doc.values,
  })
})

router.get('/experience', async (_req, res) => {
  res.json(await Experience.find().sort({ order: 1, createdAt: 1 }).lean())
})

router.get('/skills', async (_req, res) => {
  res.json(await SkillCategory.find().sort({ order: 1, createdAt: 1 }).lean())
})

router.get('/projects', async (_req, res) => {
  res.json(await Project.find({ published: true }).sort({ order: 1, createdAt: 1 }).lean())
})

router.get('/testimonials', async (_req, res) => {
  res.json(await Testimonial.find().sort({ order: 1, createdAt: 1 }).lean())
})

router.get('/contact', async (_req, res) => {
  const doc = await Contact.findOne({ singleton: 'contact' }).lean()
  if (!doc) return res.json(null)
  res.json({
    intro: doc.intro,
    availability: doc.availability,
    responseTime: doc.responseTime,
    links: doc.links,
  })
})

router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body || {}
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing required fields' })
  const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.socket.remoteAddress
  await Message.create({
    name, email, subject: subject || '', message,
    ip, userAgent: req.headers['user-agent'] || '',
  })
  res.json({ ok: true })
})

function detectDevice(ua) {
  if (!ua) return 'unknown'
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile'
  return 'desktop'
}

router.post('/track', async (req, res) => {
  const { page, pageIndex, durationMs, sessionId, referrer } = req.body || {}
  if (!page) return res.json({ ok: false })
  const ua = req.headers['user-agent'] || ''
  const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.socket.remoteAddress
  await PageView.create({
    page, pageIndex, durationMs, sessionId, referrer,
    userAgent: ua, ip, device: detectDevice(ua),
  })
  res.json({ ok: true })
})

export default router
