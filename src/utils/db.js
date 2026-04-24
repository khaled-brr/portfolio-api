import mongoose from 'mongoose'

let connPromise = null

export function connectMongo() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose)
  if (connPromise) return connPromise
  mongoose.set('strictQuery', true)
  connPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 5,
  })
  connPromise
    .then(() => console.log('[mongo] connected'))
    .catch((err) => {
      console.error('[mongo] connection failed:', err.message)
      connPromise = null
    })
  return connPromise
}
