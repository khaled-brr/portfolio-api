import { User } from '../models/User.js'
import { Hero } from '../models/Hero.js'
import { About } from '../models/About.js'
import { Experience } from '../models/Experience.js'
import { SkillCategory } from '../models/SkillCategory.js'
import { Project } from '../models/Project.js'
import { Testimonial } from '../models/Testimonial.js'
import { Contact } from '../models/Contact.js'
import { hashPassword } from './auth.js'

import { heroData } from '../../data/hero.js'
import { aboutData } from '../../data/about.js'
import { experienceData } from '../../data/experience.js'
import { skillsData } from '../../data/skills.js'
import { projectsData } from '../../data/projects.js'
import { testimonialsData } from '../../data/testimonials.js'
import { contactData } from '../../data/contact.js'

export async function seedIfEmpty() {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if ((await User.countDocuments()) === 0) {
    await User.create({
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      name: 'Admin',
    })
    console.log('[seed] admin user created:', adminEmail)
  }

  if ((await Hero.countDocuments()) === 0) {
    await Hero.create({
      singleton: 'hero',
      firstName: heroData.name.first,
      lastName: heroData.name.last,
      role: heroData.role,
      tagline: heroData.tagline,
      availability: heroData.availability,
      cvUrl: heroData.cvUrl,
      stats: heroData.stats,
    })
  }

  if ((await About.countDocuments()) === 0) {
    await About.create({ singleton: 'about', ...aboutData })
  }

  if ((await Experience.countDocuments()) === 0) {
    await Experience.insertMany(experienceData.map((j, i) => ({ ...j, order: i })))
  }

  if ((await SkillCategory.countDocuments()) === 0) {
    await SkillCategory.insertMany(skillsData.map((c, i) => ({ ...c, order: i })))
  }

  if ((await Project.countDocuments()) === 0) {
    await Project.insertMany(projectsData.map((p, i) => ({ ...p, order: i })))
  }

  if ((await Testimonial.countDocuments()) === 0) {
    await Testimonial.insertMany(testimonialsData.map((t, i) => ({ ...t, order: i })))
  }

  if ((await Contact.countDocuments()) === 0) {
    await Contact.create({ singleton: 'contact', ...contactData })
  }

  console.log('[seed] done')
}
