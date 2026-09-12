import type { Person, Project, Task } from './types'

export const currentManager = { name: 'Maya Chen', email: 'maya@velozity.dev', initials: 'MC' }
export const currentDeveloper = { name: 'Aarav Shah', email: 'aarav@velozity.dev', initials: 'AS' }
export const currentAdmin = { name: 'Anika Verma', email: 'anika@velozity.dev', initials: 'AV' }

export const projects: Project[] = [
  { id: 'prj-1', name: 'Commerce Replatform', code: 'COM-24', client: 'Northstar Retail', manager: 'Maya Chen', progress: 68, tasks: 6, overdue: 1, dueDate: '18 Sep 2026', dueAt: '2026-09-18', description: 'Rebuild the storefront and checkout experience on the new commerce platform.', status: 'AT RISK' },
  { id: 'prj-2', name: 'Member Portal', code: 'POR-17', client: 'Forma Health', manager: 'Maya Chen', progress: 84, tasks: 5, overdue: 0, dueDate: '24 Sep 2026', dueAt: '2026-09-24', description: 'A secure self-service portal for members to manage benefits and support requests.', status: 'ACTIVE' },
  { id: 'prj-3', name: 'Data Operations Hub', code: 'DAT-09', client: 'Axis Freight', manager: 'Rohan Mehta', progress: 42, tasks: 4, overdue: 1, dueDate: '02 Oct 2026', dueAt: '2026-10-02', description: 'Internal data quality and shipment monitoring workspace.', status: 'ACTIVE' },
]

export const tasks: Task[] = [
  { id: 124, title: 'Resolve checkout tax mismatch', description: 'Correct regional tax rounding at checkout and add regression coverage.', projectId: 'prj-1', project: 'Commerce Replatform', assignee: 'Aarav Shah', initials: 'AS', status: 'IN REVIEW', priority: 'CRITICAL', dueDate: 'Today, 6:00 PM', dueAt: '2026-09-12' },
  { id: 118, title: 'Add saved payment methods', description: 'Allow returning customers to select an existing vaulted card.', projectId: 'prj-1', project: 'Commerce Replatform', assignee: 'Noah Williams', initials: 'NW', status: 'IN PROGRESS', priority: 'HIGH', dueDate: '10 Sep 2026', dueAt: '2026-09-10', overdue: true },
  { id: 121, title: 'Rebuild product search index', description: 'Move catalog indexing to the new searchable product model.', projectId: 'prj-1', project: 'Commerce Replatform', assignee: 'Ishita Bose', initials: 'IB', status: 'TO DO', priority: 'HIGH', dueDate: '15 Sep 2026', dueAt: '2026-09-15' },
  { id: 126, title: 'Migrate discount rules', description: 'Port active promotion rules and validate stacking behaviour.', projectId: 'prj-1', project: 'Commerce Replatform', assignee: 'Kabir Singh', initials: 'KS', status: 'TO DO', priority: 'MEDIUM', dueDate: '17 Sep 2026', dueAt: '2026-09-17' },
  { id: 129, title: 'Checkout accessibility pass', description: 'Resolve the remaining keyboard and announcement issues.', projectId: 'prj-1', project: 'Commerce Replatform', assignee: 'Aarav Shah', initials: 'AS', status: 'DONE', priority: 'MEDIUM', dueDate: '11 Sep 2026', dueAt: '2026-09-11' },
  { id: 132, title: 'Configure production redirects', description: 'Map legacy commerce routes to their new destinations.', projectId: 'prj-1', project: 'Commerce Replatform', assignee: 'Noah Williams', initials: 'NW', status: 'IN PROGRESS', priority: 'LOW', dueDate: '18 Sep 2026', dueAt: '2026-09-18' },
  { id: 96, title: 'Audit permission boundaries', description: 'Verify that member records follow least-privilege access rules.', projectId: 'prj-2', project: 'Member Portal', assignee: 'Ishita Bose', initials: 'IB', status: 'IN REVIEW', priority: 'HIGH', dueDate: '14 Sep 2026', dueAt: '2026-09-14' },
  { id: 88, title: 'Create accessibility checklist', description: 'Document the release accessibility criteria for every portal screen.', projectId: 'prj-2', project: 'Member Portal', assignee: 'Aarav Shah', initials: 'AS', status: 'DONE', priority: 'LOW', dueDate: '09 Sep 2026', dueAt: '2026-09-09' },
  { id: 101, title: 'Add dependent management', description: 'Build the household dependent management workflow.', projectId: 'prj-2', project: 'Member Portal', assignee: 'Kabir Singh', initials: 'KS', status: 'IN PROGRESS', priority: 'MEDIUM', dueDate: '16 Sep 2026', dueAt: '2026-09-16' },
  { id: 105, title: 'Export claim history', description: 'Generate a CSV export for the member claim history view.', projectId: 'prj-2', project: 'Member Portal', assignee: 'Noah Williams', initials: 'NW', status: 'TO DO', priority: 'MEDIUM', dueDate: '21 Sep 2026', dueAt: '2026-09-21' },
  { id: 110, title: 'Polish empty states', description: 'Add useful guidance to empty member data screens.', projectId: 'prj-2', project: 'Member Portal', assignee: 'Aarav Shah', initials: 'AS', status: 'DONE', priority: 'LOW', dueDate: '12 Sep 2026', dueAt: '2026-09-12' },
]

export const people: Person[] = [
  { id: 'usr-4', name: 'Aarav Shah', initials: 'AS', email: 'aarav@velozity.dev', role: 'DEVELOPER', status: 'ACTIVE', workload: '3 assigned' },
  { id: 'usr-5', name: 'Ishita Bose', initials: 'IB', email: 'ishita@velozity.dev', role: 'DEVELOPER', status: 'ACTIVE', workload: '2 assigned' },
  { id: 'usr-6', name: 'Noah Williams', initials: 'NW', email: 'noah@velozity.dev', role: 'DEVELOPER', status: 'ACTIVE', workload: '3 assigned' },
  { id: 'usr-7', name: 'Kabir Singh', initials: 'KS', email: 'kabir@velozity.dev', role: 'DEVELOPER', status: 'ACTIVE', workload: '2 assigned' },
]

export const clients = ['Northstar Retail', 'Forma Health', 'Axis Freight', 'Peak Systems']

export const initialActivity = [
  { id: 1, initials: 'AS', actor: 'Aarav Shah', action: 'moved Task #124 from In Progress to In Review', time: '2 min ago', tone: 'orange' },
  { id: 2, initials: 'MC', actor: 'Maya Chen', action: 'assigned Task #126 to Kabir Singh', time: '18 min ago', tone: 'lime' },
  { id: 3, initials: 'IB', actor: 'Ishita Bose', action: 'completed Task #88 in Member Portal', time: '42 min ago', tone: 'green' },
  { id: 4, initials: 'MC', actor: 'Maya Chen', action: 'updated the due date for Task #121', time: '1 hr ago', tone: 'blue' },
  { id: 5, initials: 'SYS', actor: 'System', action: 'flagged Task #118 as overdue', time: '2 hr ago', tone: 'red' },
]

export const initialNotifications = [
  { id: 1, title: 'Task ready for review', body: 'Aarav moved #124 to In Review.', time: '2 min ago', read: false, tone: 'orange' },
  { id: 2, title: 'Due date approaching', body: '#96 is due on 14 Sep.', time: '34 min ago', read: false, tone: 'blue' },
  { id: 3, title: 'Task overdue', body: '#118 missed its due date.', time: '2 hr ago', read: false, tone: 'red' },
]
