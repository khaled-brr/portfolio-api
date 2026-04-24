import mongoose from 'mongoose'

const ProjectSchema = new mongoose.Schema(
  {
    name: String,
    client: String,
    type: String,
    category: {
      type: String,
      enum: ['government', 'corporate', 'freelance', 'personal'],
      default: 'corporate',
    },
    desc: String,
    tech: [String],
    link: String,
    github: String,
    image: String,
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema)
