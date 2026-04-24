import { Router } from 'express'
import { Hero } from '../models/Hero.js'
import { About } from '../models/About.js'
import { Contact } from '../models/Contact.js'
import { Experience } from '../models/Experience.js'
import { SkillCategory } from '../models/SkillCategory.js'
import { Project } from '../models/Project.js'
import { Testimonial } from '../models/Testimonial.js'
import { Message } from '../models/Message.js'
import { PageView } from '../models/Analytics.js'
import { ActivityLog } from '../models/ActivityLog.js'
import { logActivity } from '../utils/activity.js'
import { requireAuth } from '../utils/auth.js'

const router = Router()
router.use(requireAuth)

// ─── singletons ──────────────────────────────────────────────────────────
router.get('/hero', async (_req, res) => {
  res.json(await Hero.findOne({ singleton: 'hero' }).lean())
})
router.put('/hero', async (req, res) => {
  const doc = await Hero.findOneAndUpdate({ singleton: 'hero' }, { $set: req.body }, { new: true, upsert: true }).lean()
  await logActivity({ action: 'update', entity: 'hero', summary: 'Hero updated', user: req.user.email })
  res.json(doc)
})

router.get('/about', async (_req, res) => {
  res.json(await About.findOne({ singleton: 'about' }).lean())
})
router.put('/about', async (req, res) => {
  const doc = await About.findOneAndUpdate({ singleton: 'about' }, { $set: req.body }, { new: true, upsert: true }).lean()
  await logActivity({ action: 'update', entity: 'about', summary: 'About updated', user: req.user.email })
  res.json(doc)
})

router.get('/contact', async (_req, res) => {
  res.json(await Contact.findOne({ singleton: 'contact' }).lean())
})
router.put('/contact', async (req, res) => {
  const doc = await Contact.findOneAndUpdate({ singleton: 'contact' }, { $set: req.body }, { new: true, upsert: true }).lean()
  await logActivity({ action: 'update', entity: 'contact', summary: 'Contact updated', user: req.user.email })
  res.json(doc)
})

// ─── helper for CRUD collections ─────────────────────────────────────────
function crud(path, Model, label, summaryFn) {
  router.get(path, async (_req, res) => {
    res.json(await Model.find().sort({ order: 1, createdAt: 1 }).lean())
  })
  router.post(path, async (req, res) => {
    const count = await Model.countDocuments()
    const doc = await Model.create({ ...req.body, order: req.body.order ?? count })
    await logActivity({ action: 'create', entity: label, entityId: doc._id.toString(), summary: `Added: ${summaryFn(doc)}`, user: req.user.email })
    res.json(doc)
  })
  router.put(`${path}/:id`, async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    await logActivity({ action: 'update', entity: label, entityId: req.params.id, summary: `Updated: ${summaryFn(doc)}`, user: req.user.email })
    res.json(doc)
  })
  router.delete(`${path}/:id`, async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    await logActivity({ action: 'delete', entity: label, entityId: req.params.id, summary: `Deleted: ${summaryFn(doc)}`, user: req.user.email })
    res.json({ ok: true })
  })
  router.post(`${path}/reorder`, async (req, res) => {
    const { ids } = req.body || {}
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' })
    await Promise.all(ids.map((id, i) => Model.updateOne({ _id: id }, { order: i })))
    res.json({ ok: true })
  })
}

crud('/experience', Experience, 'experience', (d) => `${d.role} @ ${d.company}`)
crud('/skills', SkillCategory, 'skillCategory', (d) => d.name)
crud('/projects', Project, 'project', (d) => d.name)
crud('/testimonials', Testimonial, 'testimonial', (d) => `from ${d.name}`)

// ─── messages ─────────────────────────────────────────────────────────────
router.get('/messages', async (req, res) => {
  const filter = {}
  if (req.query.archived === 'true') filter.archived = true
  else filter.archived = { $ne: true }
  if (req.query.unread === 'true') filter.read = false
  res.json(await Message.find(filter).sort({ createdAt: -1 }).limit(200).lean())
})
router.patch('/messages/:id', async (req, res) => {
  const doc = await Message.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})
router.delete('/messages/:id', async (req, res) => {
  await Message.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

// ─── analytics ───────────────────────────────────────────────────────────
router.get('/analytics/summary', async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '30', 10), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [totalViews, uniqueSessionsArr, byPage, byDevice, byDay, totalMessages, unreadMessages] = await Promise.all([
    PageView.countDocuments({ createdAt: { $gte: since } }),
    PageView.distinct('sessionId', { createdAt: { $gte: since } }),
    PageView.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$page', views: { $sum: 1 }, avgDuration: { $avg: '$durationMs' } } },
      { $sort: { views: -1 } },
    ]),
    PageView.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
    ]),
    PageView.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Message.countDocuments(),
    Message.countDocuments({ read: false, archived: { $ne: true } }),
  ])
  res.json({
    range: { days, since },
    totalViews,
    uniqueSessions: uniqueSessionsArr.filter(Boolean).length,
    byPage,
    byDevice,
    byDay,
    totalMessages,
    unreadMessages,
  })
})

// ─── activity log ────────────────────────────────────────────────────────
router.get('/activity', async (_req, res) => {
  res.json(await ActivityLog.find().sort({ createdAt: -1 }).limit(100).lean())
})

// ─── backup ──────────────────────────────────────────────────────────────
router.get('/backup/export', async (_req, res) => {
  const [hero, about, experience, skills, projects, testimonials, contact] = await Promise.all([
    Hero.findOne({ singleton: 'hero' }).lean(),
    About.findOne({ singleton: 'about' }).lean(),
    Experience.find().sort({ order: 1 }).lean(),
    SkillCategory.find().sort({ order: 1 }).lean(),
    Project.find().sort({ order: 1 }).lean(),
    Testimonial.find().sort({ order: 1 }).lean(),
    Contact.findOne({ singleton: 'contact' }).lean(),
  ])
  res.setHeader('Content-Type', 'application/json')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="portfolio-backup-${new Date().toISOString().slice(0, 10)}.json"`
  )
  res.json({ exportedAt: new Date(), hero, about, experience, skills, projects, testimonials, contact })
})

router.post('/backup/import', async (req, res) => {
  const body = req.body
  if (!body) return res.status(400).json({ error: 'No payload' })
  if (body.hero) await Hero.findOneAndUpdate({ singleton: 'hero' }, { ...body.hero, singleton: 'hero' }, { upsert: true })
  if (body.about) await About.findOneAndUpdate({ singleton: 'about' }, { ...body.about, singleton: 'about' }, { upsert: true })
  if (body.contact) await Contact.findOneAndUpdate({ singleton: 'contact' }, { ...body.contact, singleton: 'contact' }, { upsert: true })
  if (Array.isArray(body.experience)) {
    await Experience.deleteMany({})
    await Experience.insertMany(body.experience.map((x, i) => ({ ...x, _id: undefined, order: x.order ?? i })))
  }
  if (Array.isArray(body.skills)) {
    await SkillCategory.deleteMany({})
    await SkillCategory.insertMany(body.skills.map((x, i) => ({ ...x, _id: undefined, order: x.order ?? i })))
  }
  if (Array.isArray(body.projects)) {
    await Project.deleteMany({})
    await Project.insertMany(body.projects.map((x, i) => ({ ...x, _id: undefined, order: x.order ?? i })))
  }
  if (Array.isArray(body.testimonials)) {
    await Testimonial.deleteMany({})
    await Testimonial.insertMany(body.testimonials.map((x, i) => ({ ...x, _id: undefined, order: x.order ?? i })))
  }
  await logActivity({ action: 'import', entity: 'backup', summary: 'Data imported from backup', user: req.user.email })
  res.json({ ok: true })
})

export default router
