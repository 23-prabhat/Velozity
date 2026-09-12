export type TaskStatus = 'TO DO' | 'IN PROGRESS' | 'IN REVIEW' | 'DONE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Project {
  id: string
  name: string
  code: string
  client: string
  manager: string
  progress: number
  tasks: number
  overdue: number
  dueDate: string
  dueAt: string
  description: string
  status: 'ACTIVE' | 'AT RISK' | 'ON HOLD'
}

export interface Task {
  id: number
  title: string
  description: string
  projectId: string
  project: string
  assignee: string
  initials: string
  status: TaskStatus
  priority: Priority
  dueDate: string
  dueAt: string
  overdue?: boolean
}

export interface Person {
  id: string
  name: string
  initials: string
  email: string
  role: 'ADMIN' | 'PROJECT MANAGER' | 'DEVELOPER'
  status: 'ACTIVE' | 'INACTIVE'
  workload: string
}

export type View = 'dashboard' | 'projects' | 'tasks' | 'activity'
