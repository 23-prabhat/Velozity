import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'

export async function eventTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${8_142_026})`
    return work(tx)
  })
}
