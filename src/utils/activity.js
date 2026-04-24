import { ActivityLog } from '../models/ActivityLog.js'

export async function logActivity({ action, entity, entityId, summary, user, meta }) {
  try {
    await ActivityLog.create({ action, entity, entityId, summary, user, meta })
  } catch (err) {
    console.error('[activity] log failed', err)
  }
}
