import mongoose from 'mongoose'

const StatSchema = new mongoose.Schema({ number: String, label: String }, { _id: false })

const HeroSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'hero', unique: true },
    firstName: String,
    lastName: String,
    role: String,
    tagline: String,
    availability: String,
    cvUrl: String,
    stats: [StatSchema],
  },
  { timestamps: true }
)

export const Hero = mongoose.models.Hero || mongoose.model('Hero', HeroSchema)
