const WINDOW_MS = 60_000
const MAX_WRITES = 30
const MAX_KEYS = 10_000

type Budget = { windowStart: number; count: number }
const budgets = new Map<string, Budget>()

export function reserveAdminWrite(sessionId: string, now = Date.now()): boolean {
  const current = budgets.get(sessionId)
  if (!current || now - current.windowStart >= WINDOW_MS) {
    if (budgets.size >= MAX_KEYS) {
      for (const [key, value] of budgets) {
        if (now - value.windowStart >= WINDOW_MS) budgets.delete(key)
      }
      if (budgets.size >= MAX_KEYS) return false
    }
    budgets.set(sessionId, { windowStart: now, count: 1 })
    return true
  }
  if (current.count >= MAX_WRITES) return false
  current.count += 1
  return true
}
