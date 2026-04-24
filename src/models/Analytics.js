import mongoose from 'mongoose'

const PageViewSchema = new mongoose.Schema(
  {
    page: { type: String, required: true },
    pageIndex: Number,
    durationMs: Number,
    sessionId: String,
    referrer: String,
    userAgent: String,
    ip: String,
    country: String,
    device: { type: String, enum: ['desktop', 'tablet', 'mobile', 'unknown'], default: 'unknown' },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
)

export const PageView = mongoose.models.PageView || mongoose.model('PageView', PageViewSchema)
