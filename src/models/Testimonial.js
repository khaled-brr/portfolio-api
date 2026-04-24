import mongoose from 'mongoose'

const TestimonialSchema = new mongoose.Schema(
  {
    quote: String,
    name: String,
    role: String,
    company: String,
    relationship: String,
    avatar: String,
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export const Testimonial = mongoose.models.Testimonial || mongoose.model('Testimonial', TestimonialSchema)
