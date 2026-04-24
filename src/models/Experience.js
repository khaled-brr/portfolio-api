import mongoose from 'mongoose'

const ExperienceSchema = new mongoose.Schema(
  {
    date: String,
    role: String,
    company: String,
    highlights: [String],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const Experience = mongoose.models.Experience || mongoose.model('Experience', ExperienceSchema)
