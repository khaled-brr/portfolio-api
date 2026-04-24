import mongoose from 'mongoose'

const MessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: String,
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
)

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema)
