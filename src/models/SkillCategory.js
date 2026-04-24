import mongoose from 'mongoose'

const SkillCategorySchema = new mongoose.Schema(
  {
    name: String,
    skills: [String],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const SkillCategory =
  mongoose.models.SkillCategory || mongoose.model('SkillCategory', SkillCategorySchema)
