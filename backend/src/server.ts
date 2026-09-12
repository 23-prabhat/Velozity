import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db/prisma.js'
import { startScheduler } from './jobs/scheduler.js'
import { createGateway } from './realtime/gateway.js'

const httpServer = createServer(createApp())
const io = createGateway(httpServer)
const stopScheduler = await startScheduler()

httpServer.listen(env.PORT, () => console.info(JSON.stringify({ event: 'server_started', port: env.PORT })))

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.info(JSON.stringify({ event: 'shutdown_started', signal }))
  stopScheduler()
  io.close()
  httpServer.close(async () => { await prisma.$disconnect(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
