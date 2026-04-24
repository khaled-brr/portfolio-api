import mongoose from 'mongoose'

const MetricSchema = new mongoose.Schema({ value: String, label: String, context: String }, { _id: false })
const ValueSchema = new mongoose.Schema({ title: String, desc: String, icon: String }, { _id: false })

const AboutSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'about', unique: true },
    intro: String,
    businessIntro: String,
    impactMetrics: [MetricSchema],
    values: [ValueSchema],
  },
  { timestamps: true }
)

export const About = mongoose.models.About || mongoose.model('About', AboutSchema)
