import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'

export async function eventTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(
    async (tx) => {
      // Do not return PostgreSQL's `void` lock value to Prisma; Neon/Prisma cannot deserialize it.
      await tx.$queryRaw`SELECT 1 AS "locked" FROM (SELECT pg_advisory_xact_lock(${8_142_026})) AS advisory_lock`
      return work(tx)
    },
    // Neon can take more than Prisma's five-second default to wake and complete
    // the first interactive transaction after an idle period.
    { maxWait: 10_000, timeout: 20_000 },
  )
}
