import cron from 'node-cron'
import { env } from '../config/env.js'
import { markOverdueTasks } from './overdue.service.js'

export async function startScheduler() {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    const startedAt = Date.now()
    try { const changed = await markOverdueTasks(); console.info(JSON.stringify({ event: 'overdue_job_complete', changed, durationMs: Date.now() - startedAt })) }
    catch (error) { console.error(JSON.stringify({ event: 'overdue_job_failed', message: error instanceof Error ? error.message : 'Unknown error' })) }
    finally { running = false }
  }
  await run()
  const task = cron.schedule(env.OVERDUE_CRON, run, { timezone: env.APP_TIMEZONE })
  return () => task.stop()
}
