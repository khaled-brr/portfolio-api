import mongoose from 'mongoose'

const ActivityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    summary: String,
    user: String,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
)

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema)
