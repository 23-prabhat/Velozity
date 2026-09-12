import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

export const checkDatabase = async () => { await prisma.$queryRaw`SELECT 1` }
