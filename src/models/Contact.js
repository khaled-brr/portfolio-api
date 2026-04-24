import mongoose from 'mongoose'

const LinkSchema = new mongoose.Schema(
  { label: String, value: String, href: String, external: { type: Boolean, default: false } },
  { _id: false }
)

const ContactSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'contact', unique: true },
    intro: String,
    availability: String,
    responseTime: String,
    links: [LinkSchema],
  },
  { timestamps: true }
)

export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema)
