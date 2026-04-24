import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: 'Admin' },
    role: { type: String, enum: ['admin'], default: 'admin' },
  },
  { timestamps: true }
)

export const User = mongoose.models.User || mongoose.model('User', UserSchema)
