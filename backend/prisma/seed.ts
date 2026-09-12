import { ActivityType, NotificationType, PrismaClient, Priority, Role, TaskStatus } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()
const ids = {
  admin: '10000000-0000-4000-8000-000000000001', pm1: '10000000-0000-4000-8000-000000000002', pm2: '10000000-0000-4000-8000-000000000003',
  dev1: '10000000-0000-4000-8000-000000000004', dev2: '10000000-0000-4000-8000-000000000005', dev3: '10000000-0000-4000-8000-000000000006', dev4: '10000000-0000-4000-8000-000000000007',
  client1: '20000000-0000-4000-8000-000000000001', client2: '20000000-0000-4000-8000-000000000002', client3: '20000000-0000-4000-8000-000000000003',
  project1: '30000000-0000-4000-8000-000000000001', project2: '30000000-0000-4000-8000-000000000002', project3: '30000000-0000-4000-8000-000000000003',
}
const taskId = (number: number) => `40000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const eventId = (number: number) => `50000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000)

async function main() {
  const passwords = {
    admin: process.env.SEED_ADMIN_PASSWORD,
    pm: process.env.SEED_PM_PASSWORD,
    developer: process.env.SEED_DEVELOPER_PASSWORD,
  }
  if (!passwords.admin || !passwords.pm || !passwords.developer) throw new Error('Set all SEED_*_PASSWORD values before seeding.')
  const hashes = { admin: await argon2.hash(passwords.admin), pm: await argon2.hash(passwords.pm), developer: await argon2.hash(passwords.developer) }
  const users = [
    { id: ids.admin, name: 'Anika Verma', email: 'anika@velozity.dev', role: Role.ADMIN, passwordHash: hashes.admin },
    { id: ids.pm1, name: 'Maya Chen', email: 'maya@velozity.dev', role: Role.PROJECT_MANAGER, passwordHash: hashes.pm },
    { id: ids.pm2, name: 'Rohan Mehta', email: 'rohan@velozity.dev', role: Role.PROJECT_MANAGER, passwordHash: hashes.pm },
    { id: ids.dev1, name: 'Aarav Shah', email: 'aarav@velozity.dev', role: Role.DEVELOPER, passwordHash: hashes.developer },
    { id: ids.dev2, name: 'Ishita Bose', email: 'ishita@velozity.dev', role: Role.DEVELOPER, passwordHash: hashes.developer },
    { id: ids.dev3, name: 'Noah Williams', email: 'noah@velozity.dev', role: Role.DEVELOPER, passwordHash: hashes.developer },
    { id: ids.dev4, name: 'Kabir Singh', email: 'kabir@velozity.dev', role: Role.DEVELOPER, passwordHash: hashes.developer },
  ]
  for (const user of users) await prisma.user.upsert({ where: { id: user.id }, update: { ...user, mustChangePassword: false, isActive: true }, create: { ...user, mustChangePassword: false } })

  const clients = [
    { id: ids.client1, name: 'Northstar Retail', contactName: 'Nina Patel', contactEmail: 'nina@northstar.example' },
    { id: ids.client2, name: 'Forma Health', contactName: 'Sam Roy', contactEmail: 'sam@forma.example' },
    { id: ids.client3, name: 'Axis Freight', contactName: 'Leena Das', contactEmail: 'leena@axis.example' },
  ]
  for (const client of clients) await prisma.client.upsert({ where: { id: client.id }, update: client, create: { ...client, createdById: ids.admin } })
  const projects = [
    { id: ids.project1, clientId: ids.client1, createdById: ids.pm1, name: 'Commerce Replatform', description: 'Rebuild storefront and checkout for the next retail release.' },
    { id: ids.project2, clientId: ids.client2, createdById: ids.pm1, name: 'Member Portal', description: 'Modernize patient member access and account workflows.' },
    { id: ids.project3, clientId: ids.client3, createdById: ids.pm2, name: 'Data Operations Hub', description: 'Unify shipment operations and exception reporting.' },
  ]
  for (const project of projects) await prisma.project.upsert({ where: { id: project.id }, update: project, create: project })

  const definitions = [
    [101, ids.project1, ids.dev1, 'Implement product search', TaskStatus.IN_PROGRESS, Priority.CRITICAL, -2],
    [102, ids.project1, ids.dev2, 'Build checkout summary', TaskStatus.IN_REVIEW, Priority.HIGH, 2],
    [103, ids.project1, ids.dev3, 'Add inventory badges', TaskStatus.TODO, Priority.MEDIUM, 4],
    [104, ids.project1, ids.dev4, 'Instrument conversion events', TaskStatus.DONE, Priority.LOW, -1],
    [105, ids.project1, ids.dev1, 'Harden payment callbacks', TaskStatus.TODO, Priority.HIGH, 7],
    [106, ids.project2, ids.dev2, 'Create member profile view', TaskStatus.IN_PROGRESS, Priority.HIGH, -4],
    [107, ids.project2, ids.dev3, 'Add appointment history', TaskStatus.TODO, Priority.MEDIUM, 3],
    [108, ids.project2, ids.dev4, 'Implement secure messages shell', TaskStatus.IN_REVIEW, Priority.CRITICAL, 1],
    [109, ids.project2, ids.dev1, 'Add accessibility landmarks', TaskStatus.DONE, Priority.MEDIUM, -3],
    [110, ids.project2, ids.dev2, 'Optimize dashboard queries', TaskStatus.TODO, Priority.LOW, 8],
    [111, ids.project3, ids.dev3, 'Build exception queue', TaskStatus.IN_PROGRESS, Priority.CRITICAL, 2],
    [112, ids.project3, ids.dev4, 'Map carrier status codes', TaskStatus.TODO, Priority.HIGH, 5],
    [113, ids.project3, ids.dev1, 'Create delivery KPI cards', TaskStatus.IN_REVIEW, Priority.MEDIUM, 6],
    [114, ids.project3, ids.dev2, 'Add CSV export', TaskStatus.DONE, Priority.LOW, -5],
    [115, ids.project3, ids.dev3, 'Implement delay alerts', TaskStatus.TODO, Priority.HIGH, 9],
  ] as const
  for (const [number, projectId, assignedDeveloperId, title, status, priority, dueOffset] of definitions) {
    const overdue = dueOffset < 0 && status !== TaskStatus.DONE
    await prisma.task.upsert({ where: { id: taskId(number) }, update: { projectId, assignedDeveloperId, title, status, priority, dueAt: daysFromNow(dueOffset), isOverdue: overdue, overdueMarkedAt: overdue ? new Date() : null }, create: { id: taskId(number), number, projectId, assignedDeveloperId, title, description: `Acceptance criteria and delivery notes for ${title.toLowerCase()}.`, status, priority, dueAt: daysFromNow(dueOffset), isOverdue: overdue, overdueMarkedAt: overdue ? new Date() : null } })
  }
  await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Task"', 'number'), (SELECT MAX("number") FROM "Task"))`)

  let index = 1
  for (const [number, projectId, assignedDeveloperId, title, status] of definitions) {
    const project = projects.find((item) => item.id === projectId)!
    const id = eventId(index++)
    await prisma.activityEvent.upsert({ where: { id }, update: {}, create: { id, projectId, taskId: taskId(number), actorId: project.createdById, type: ActivityType.TASK_ASSIGNED, metadata: { assignedDeveloperId, assignedDeveloperName: users.find((user) => user.id === assignedDeveloperId)!.name }, createdAt: daysFromNow(-10 + index / 24) } })
    if (status !== TaskStatus.TODO) {
      await prisma.activityEvent.upsert({ where: { id: eventId(index) }, update: {}, create: { id: eventId(index), projectId, taskId: taskId(number), actorId: assignedDeveloperId, type: ActivityType.STATUS_CHANGED, fromStatus: TaskStatus.TODO, toStatus: status, createdAt: daysFromNow(-5 + index / 24) } })
      index += 1
    }
  }
  const assignedEvent = await prisma.activityEvent.findUniqueOrThrow({ where: { id: eventId(1) } })
  await prisma.notification.upsert({ where: { recipientId_activityEventId_type: { recipientId: ids.dev1, activityEventId: assignedEvent.id, type: NotificationType.TASK_ASSIGNED } }, update: {}, create: { recipientId: ids.dev1, taskId: taskId(101), activityEventId: assignedEvent.id, type: NotificationType.TASK_ASSIGNED, readAt: daysFromNow(-1) } })
  const reviewEvent = await prisma.activityEvent.findFirstOrThrow({ where: { taskId: taskId(102), toStatus: TaskStatus.IN_REVIEW } })
  await prisma.notification.upsert({ where: { recipientId_activityEventId_type: { recipientId: ids.pm1, activityEventId: reviewEvent.id, type: NotificationType.TASK_IN_REVIEW } }, update: {}, create: { recipientId: ids.pm1, taskId: taskId(102), activityEventId: reviewEvent.id, type: NotificationType.TASK_IN_REVIEW } })
  console.info('Seed complete: 1 Admin, 2 PMs, 4 Developers, 3 projects, 15 tasks, activity and notifications.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
