import { useEffect, useMemo, useState } from 'react'
import { clients, currentAdmin, currentDeveloper, currentManager, initialActivity, initialNotifications, people, projects, tasks } from './data'
import { Icon } from './icons'
import { apiRequest } from './api'
import type { Priority, Project, Task, TaskStatus, View } from './types'
import './App.css'

type AuthMode = 'login' | 'signup'
type WorkspaceRole = 'ADMIN' | 'PM' | 'DEVELOPER'
type ActivityItem = (typeof initialActivity)[number]
type NotificationItem = (typeof initialNotifications)[number]
type Filters = { query: string; status: 'ALL' | TaskStatus; priority: 'ALL' | Priority; dueFrom: string; dueTo: string }
type ManagedUser = { id: string; name: string; initials: string; email: string; password?: string; mustChangePassword: boolean; role: 'ADMIN' | 'PROJECT MANAGER' | 'DEVELOPER'; status: 'ACTIVE' | 'INACTIVE'; workload: string }
type MemberRequest = { id: string; name: string; email: string; reason: string; requestedBy: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string }
type ApiUser = { id: string; name: string; email: string; role: 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER'; isActive: boolean; mustChangePassword: boolean }
type ApiMemberRequest = { id: string; name: string; email: string; reason: string; status: MemberRequest['status']; createdAt: string; requestedBy: { name: string } }

const initialsFor = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
const apiRoleToWorkspace = (role: ApiUser['role']): WorkspaceRole => role === 'PROJECT_MANAGER' ? 'PM' : role
const apiUserToManaged = (user: ApiUser): ManagedUser => ({ id: user.id, name: user.name, initials: initialsFor(user.name), email: user.email, mustChangePassword: user.mustChangePassword, role: user.role === 'PROJECT_MANAGER' ? 'PROJECT MANAGER' : user.role, status: user.isActive ? 'ACTIVE' : 'INACTIVE', workload: user.role === 'ADMIN' ? 'Global access' : user.role === 'PROJECT_MANAGER' ? 'Projects managed' : 'Assigned tasks' })
const apiRequestToMember = (request: ApiMemberRequest): MemberRequest => ({ ...request, requestedBy: request.requestedBy.name, createdAt: new Date(request.createdAt).toLocaleString() })

const roleRoot: Record<WorkspaceRole, string> = { ADMIN: '/admin', PM: '/pm', DEVELOPER: '/developer' }
const routeTo = (path: string, replace = false) => window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
const viewFromPath = <T extends string,>(root: string, allowed: readonly T[], fallback: T): T => {
  const segment = window.location.pathname.replace(new RegExp(`^${root}/?`), '').split('/')[0]
  return allowed.includes(segment as T) ? segment as T : fallback
}
const workspacePath = (root: string, view: string) => view === 'dashboard' ? root : `${root}/${view}`

const initialManagedUsers: ManagedUser[] = [
  { id: 'admin', name: currentAdmin.name, initials: currentAdmin.initials, email: currentAdmin.email, password: 'velozity123', mustChangePassword: false, role: 'ADMIN', status: 'ACTIVE', workload: 'Global access' },
  { id: 'pm1', name: currentManager.name, initials: currentManager.initials, email: currentManager.email, password: 'velozity123', mustChangePassword: false, role: 'PROJECT MANAGER', status: 'ACTIVE', workload: '2 projects' },
  { id: 'pm2', name: 'Rohan Mehta', initials: 'RM', email: 'rohan@velozity.dev', password: 'velozity123', mustChangePassword: false, role: 'PROJECT MANAGER', status: 'ACTIVE', workload: '1 project' },
  ...people.map((person) => ({ ...person, password: 'velozity123', mustChangePassword: false })),
]

const ownedSeedProjects = projects.filter((project) => project.manager === currentManager.name)
const ownedProjectIds = new Set(ownedSeedProjects.map((project) => project.id))
const ownedSeedTasks = tasks.filter((task) => ownedProjectIds.has(task.projectId))
const priorityOrder: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const navItems = [
  { id: 'dashboard', label: 'Overview', icon: 'grid' },
  { id: 'projects', label: 'My projects', icon: 'folder' },
  { id: 'tasks', label: 'Team tasks', icon: 'check' },
  { id: 'activity', label: 'Team activity', icon: 'pulse' },
] as const
const adminViews = ['dashboard', 'projects', 'tasks', 'clients', 'users', 'activity'] as const
type AdminView = (typeof adminViews)[number]
const developerViews = ['dashboard', 'tasks', 'activity'] as const
type DeveloperView = (typeof developerViews)[number]
const pmViews: readonly View[] = ['dashboard', 'projects', 'tasks', 'activity']

const pageCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: 'Friday · 12 Sep 2026', title: 'Good morning, Maya.', description: 'Here is what needs your attention across your projects.' },
  projects: { eyebrow: 'Owned portfolio', title: 'My projects', description: 'Create projects, manage delivery, and assign work to your team.' },
  tasks: { eyebrow: 'Delivery queue', title: 'Team tasks', description: 'Filter, assign, and move work across your owned projects.' },
  activity: { eyebrow: 'Live record', title: 'Team activity', description: 'Updates from your projects and assigned developers only.' },
}

function todayLabel(date: string) {
  if (!date) return 'Not set'
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

function Avatar({ initials, tone = 'dark' }: { initials: string; tone?: string }) {
  return <span className={`avatar avatar--${tone}`}>{initials}</span>
}

function Progress({ value }: { value: number }) {
  return <div className="progress" aria-label={`${value}% complete`}><span style={{ width: `${value}%` }} /></div>
}

function Logo() {
  return <div className="brand"><span className="brand-mark">V</span><div><strong>VELOZITY</strong><small>PROJECT DESK</small></div></div>
}

function AuthScreen({ onAuthenticate, onAdminSetup }: { onAuthenticate: (role: WorkspaceRole, accessToken?: string) => void; onAdminSetup: (user: ManagedUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState(currentManager.email)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (mode === 'signup') {
      if (String(form.get('password')).length < 8) { setError('Use at least 8 characters for your password.'); return }
      if (String(form.get('setupCode')).trim() !== 'VELOZITY-SETUP') { setError('Enter the company setup code supplied to the founding administrator.'); return }
      const name = String(form.get('name')).trim()
      onAdminSetup({ id: `admin-${Date.now()}`, name, initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), email: String(form.get('email')).toLowerCase(), password: String(form.get('password')), mustChangePassword: false, role: 'ADMIN', status: 'ACTIVE', workload: 'Global access' })
      return
    }
    if (!String(form.get('email')).includes('@') || !String(form.get('password'))) { setError('Enter a valid email and password.'); return }
    setSubmitting(true); setError('')
    try {
      const result = await apiRequest<{ accessToken: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: String(form.get('email')).toLowerCase(), password: String(form.get('password')) }) })
      onAuthenticate(apiRoleToWorkspace(result.user.role), result.accessToken)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to connect to the API.') }
    finally { setSubmitting(false) }
  }
  return <main className="auth-page">
    <section className="auth-story">
      <Logo />
      <div className="auth-copy"><span className="eyebrow eyebrow--light">Internal project operations</span><h1>Move work.<br/><em>See everything.</em></h1><p>A focused delivery workspace for project managers and their teams.</p></div>
      <div className="auth-status"><span className="live-label"><i/> Realtime service online</span><span>12 SEP 2026 · IST</span></div>
    </section>
    <section className="auth-form-wrap">
      <div className="auth-form-card">
        <span className="section-index">ROLE / ACCESS</span>
        <h2>{mode === 'login' ? 'Welcome back.' : 'Set up company.'}</h2>
        <p>{mode === 'login' ? 'Your account role decides which workspace opens.' : 'For the founding company administrator only. Team accounts are created inside the Admin console.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setEmail(currentManager.email); setPassword(''); setError('') }}>Log in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setEmail(''); setPassword(''); setError(''); setNotice('') }}>Admin setup</button>
        </div>
        {notice && <div className="form-notice form-notice--success">{notice}</div>}
        {error && <div className="form-notice form-notice--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          {mode === 'signup' && <><label>Company name<input name="company" required placeholder="Your company name"/></label><label>Administrator name<input name="name" required placeholder="Your full name" autoComplete="name" /></label></>}
          <label>Work email<input name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" /></label>
          <label>Password<span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={18}/></button></span></label>
          {mode === 'signup' && <label>Company setup code<input name="setupCode" required placeholder="Code from your company invitation"/></label>}
          <button className="button button--primary button--block" type="submit" disabled={submitting}>{submitting ? 'Connecting…' : mode === 'login' ? 'Enter workspace' : 'Create Admin account'} <Icon name="arrow" size={17}/></button>
        </form>
        {mode === 'login' && <div className="demo-accounts"><span>DEMO ACCOUNTS · USE THE SEED PASSWORD FROM .env</span><button type="button" onClick={() => { setEmail(currentAdmin.email); setPassword(''); setError('') }}><Avatar initials="AV" tone="blue"/><span><b>Administrator</b><small>{currentAdmin.email}</small></span><Icon name="arrow" size={14}/></button><button type="button" onClick={() => { setEmail(currentManager.email); setPassword(''); setError('') }}><Avatar initials="MC" tone="orange"/><span><b>Project manager</b><small>{currentManager.email}</small></span><Icon name="arrow" size={14}/></button><button type="button" onClick={() => { setEmail(currentDeveloper.email); setPassword(''); setError('') }}><Avatar initials="AS" tone="lime"/><span><b>Developer</b><small>{currentDeveloper.email}</small></span><Icon name="arrow" size={14}/></button></div>}
      </div>
    </section>
  </main>
}

function ActivityFeed({ items, full = false }: { items: ActivityItem[]; full?: boolean }) {
  return <div className={full ? 'activity-list activity-list--full' : 'activity-list'}>{items.map((event) => <article className="activity-item" key={event.id}>
    <Avatar initials={event.initials} tone={event.tone} /><div><p><strong>{event.actor}</strong> {event.action}</p><time>{event.time}</time></div>
  </article>)}</div>
}

function TaskFilters({ filters, onChange, resultCount }: { filters: Filters; onChange: (next: Filters) => void; resultCount: number }) {
  return <div className="filter-area"><div className="filter-bar">
    <label className="search-field"><Icon name="search" size={16}/><input aria-label="Search tasks" placeholder="Search task, project, or assignee" value={filters.query} onChange={(e) => onChange({ ...filters, query: e.target.value })}/></label>
    <label><span className="field-caption">Status</span><select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as Filters['status'] })}><option value="ALL">All statuses</option><option>TO DO</option><option>IN PROGRESS</option><option>IN REVIEW</option><option>DONE</option></select></label>
    <label><span className="field-caption">Priority</span><select value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value as Filters['priority'] })}><option value="ALL">All priorities</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></label>
    <label><span className="field-caption">Due from</span><input type="date" value={filters.dueFrom} onChange={(e) => onChange({ ...filters, dueFrom: e.target.value })}/></label>
    <label><span className="field-caption">Due to</span><input type="date" value={filters.dueTo} onChange={(e) => onChange({ ...filters, dueTo: e.target.value })}/></label>
  </div><div className="filter-meta"><span><b>{resultCount}</b> results</span><button className="text-button" onClick={() => onChange({ query: '', status: 'ALL', priority: 'ALL', dueFrom: '', dueTo: '' })}>Clear filters</button></div></div>
}

function TaskTable({ rows, onStatusChange, compact = false, onSelect }: { rows: Task[]; onStatusChange: (task: Task, status: TaskStatus) => void; compact?: boolean; onSelect?: (task: Task) => void }) {
  return <div className="table-scroll"><table className="task-table"><thead><tr><th>Task</th><th>Project</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due date</th></tr></thead><tbody>
    {rows.slice(0, compact ? 5 : undefined).map((task) => <tr key={task.id} onClick={() => onSelect?.(task)} className={onSelect ? 'clickable-row' : ''}>
      <td><span className="task-id">#{task.id}</span><strong>{task.title}</strong></td><td>{task.project}</td>
      <td><span className="person-cell"><Avatar initials={task.initials}/><span>{task.assignee}</span></span></td>
      <td onClick={(event) => event.stopPropagation()}><select className={`status-select status-select--${task.status.toLowerCase().replaceAll(' ', '-')}`} value={task.status} aria-label={`Status for ${task.title}`} onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}><option>TO DO</option><option>IN PROGRESS</option><option>IN REVIEW</option><option>DONE</option></select></td>
      <td><span className={`priority priority--${task.priority.toLowerCase()}`}>{task.priority}</span></td>
      <td className={task.overdue ? 'danger-text' : ''}>{task.overdue && <Icon name="alert" size={15}/>} {task.dueDate}</td>
    </tr>)}
  </tbody></table>{rows.length === 0 && <div className="empty-state"><strong>No tasks match</strong><span>Adjust or clear your filters to see more work.</span></div>}</div>
}

function Dashboard({ projectRows, taskRows, activityItems, onNavigate, onStatusChange, onOpenProject }: { projectRows: Project[]; taskRows: Task[]; activityItems: ActivityItem[]; onNavigate: (view: View) => void; onStatusChange: (task: Task, status: TaskStatus) => void; onOpenProject: (project: Project) => void }) {
  const upcoming = taskRows.filter((task) => task.dueAt >= '2026-09-12' && task.dueAt <= '2026-09-18' && task.status !== 'DONE').sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const priorities = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((priority) => ({ priority, count: taskRows.filter((task) => task.priority === priority && task.status !== 'DONE').length }))
  return <>
    <section className="pm-summary" aria-label="Project manager summary">
      <article className="hero-metric"><span>OWNED PROJECTS</span><strong>{projectRows.length}</strong><small>{projectRows.filter((p) => p.status === 'AT RISK').length} needs attention</small></article>
      <article><span>OPEN TASKS</span><strong>{taskRows.filter((t) => t.status !== 'DONE').length}</strong><small>{taskRows.filter((t) => t.status === 'IN REVIEW').length} waiting for review</small></article>
      <article className="danger-metric"><span>OVERDUE</span><strong>{taskRows.filter((t) => t.overdue).length}</strong><small>Escalate today</small></article>
      <article className="week-metric"><span>DUE THIS WEEK</span><strong>{upcoming.length}</strong><small>Through 18 September</small></article>
    </section>
    <div className="dashboard-grid">
      <section className="panel panel--projects"><div className="panel-heading"><div><span className="section-index">01</span><h2>Project pulse</h2></div><button className="text-button" onClick={() => onNavigate('projects')}>View all <Icon name="arrow" size={15}/></button></div>
        <div className="project-stack">{projectRows.map((project) => <button className="project-row" key={project.id} onClick={() => onOpenProject(project)}><span className="project-number">{project.code.slice(-2)}</span><span className="project-main"><span><strong>{project.name}</strong><small>{project.client}</small></span><Progress value={project.progress}/></span><span className="project-progress"><strong>{project.progress}%</strong><small>{project.tasks} tasks</small></span><Badge tone={project.status.toLowerCase().replaceAll(' ', '-')}>{project.status}</Badge><Icon name="chevron" size={17}/></button>)}</div>
      </section>
      <aside className="panel priority-panel"><div className="panel-heading"><div><span className="section-index">02</span><h2>Open by priority</h2></div></div><div className="priority-breakdown">{priorities.map(({ priority, count }) => <div key={priority}><span className={`priority priority--${priority.toLowerCase()}`}>{priority}</span><strong>{count}</strong><span className="priority-line"><i style={{ width: `${Math.max(8, count * 20)}%` }}/></span></div>)}</div></aside>
    </div>
    <div className="dashboard-grid dashboard-grid--lower">
      <section className="panel"><div className="panel-heading"><div><span className="section-index">03</span><h2>Due this week</h2></div><button className="text-button" onClick={() => onNavigate('tasks')}>Open queue <Icon name="arrow" size={15}/></button></div><TaskTable rows={upcoming} onStatusChange={onStatusChange} compact/></section>
      <aside className="panel activity-panel"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE</span><h2>Team activity</h2></div><span className="live-label"><i/> Connected</span></div><ActivityFeed items={activityItems.slice(0, 4)}/><button className="wide-link" onClick={() => onNavigate('activity')}>Full activity log <Icon name="arrow" size={15}/></button></aside>
    </div>
  </>
}

function ProjectsPage({ rows, onOpen, onCreate }: { rows: Project[]; onOpen: (project: Project) => void; onCreate: () => void }) {
  return <><div className="portfolio-intro"><div><strong>{rows.length}</strong><span>projects owned by you</span></div><p>Only projects you created are visible in this workspace. Ownership and permissions are enforced by the API when connected.</p></div><section className="project-grid">{rows.map((project, index) => <button className="project-card" key={project.id} onClick={() => onOpen(project)}><span className="card-index">0{index + 1}</span><Badge tone={project.status.toLowerCase().replaceAll(' ', '-')}>{project.status}</Badge><div><span className="task-id">{project.code}</span><h2>{project.name}</h2><p>{project.description}</p></div><dl><div><dt>Client</dt><dd>{project.client}</dd></div><div><dt>Target</dt><dd>{project.dueDate}</dd></div><div><dt>Tasks</dt><dd>{project.tasks}</dd></div><div><dt>Overdue</dt><dd className={project.overdue ? 'danger-text' : ''}>{project.overdue}</dd></div></dl><Progress value={project.progress}/><span className="card-action">Open project <Icon name="arrow" size={15}/></span></button>)}<button className="new-project-card" onClick={onCreate}><Icon name="plus" size={25}/><strong>Create another project</strong><span>Start a new client engagement</span></button></section></>
}

function ProjectDetail({ project, rows, activityItems, onBack, onNewTask, onStatusChange }: { project: Project; rows: Task[]; activityItems: ActivityItem[]; onBack: () => void; onNewTask: () => void; onStatusChange: (task: Task, status: TaskStatus) => void }) {
  return <><button className="back-button" onClick={onBack}>← Back to projects</button><section className="project-hero"><div><span className="eyebrow">{project.code} · {project.client}</span><h1>{project.name}</h1><p>{project.description}</p></div><div className="project-hero-meta"><Badge tone={project.status.toLowerCase().replaceAll(' ', '-')}>{project.status}</Badge><span>Target <b>{project.dueDate}</b></span><span>Progress <b>{project.progress}%</b></span></div></section><div className="project-detail-grid"><section className="panel"><div className="panel-heading"><div><span className="section-index">TASKS / {rows.length}</span><h2>Delivery board</h2></div><button className="button button--primary button--small" onClick={onNewTask}><Icon name="plus" size={16}/> Add task</button></div><TaskTable rows={rows} onStatusChange={onStatusChange}/></section><aside className="panel activity-panel"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE</span><h2>Project activity</h2></div></div><ActivityFeed items={activityItems}/></aside></div></>
}

function Dialog({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-header"><div><span className="eyebrow">{eyebrow}</span><h2 id="dialog-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></div>{children}</section></div>
}

function UserDialog({ user, onClose, onSave }: { user: ManagedUser | null; onClose: () => void; onSave: (user: ManagedUser) => Promise<void> }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const confirmPassword = String(form.get('confirmPassword'))
    if (!user && password.length < 8) { setError('Set a temporary password with at least 8 characters.'); return }
    if (password && password.length < 8) { setError('The new password must have at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return }
    const name = String(form.get('name')).trim()
    const role = String(form.get('role')) as ManagedUser['role']
    setSubmitting(true)
    try { await onSave({ id: user?.id ?? '', name, initials: initialsFor(name), email: String(form.get('email')).toLowerCase(), password: password || undefined, mustChangePassword: password ? true : user?.mustChangePassword ?? true, role, status: user?.status ?? 'ACTIVE', workload: role === 'PROJECT MANAGER' ? '0 projects' : role === 'DEVELOPER' ? '0 assigned' : 'Global access' }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save this user.') }
    finally { setSubmitting(false) }
  }
  return <Dialog title={user ? 'Edit team member' : 'Add team member'} eyebrow="Admin controlled" onClose={onClose}><form onSubmit={submit}><label>Full name<input name="name" defaultValue={user?.name} required placeholder="Team member name"/></label><label>Work email<input name="email" type="email" defaultValue={user?.email} required placeholder="name@company.com"/></label><label>Role<select name="role" defaultValue={user?.role ?? 'DEVELOPER'} disabled={user?.role === 'ADMIN'}>{user?.role === 'ADMIN' && <option>ADMIN</option>}<option>PROJECT MANAGER</option><option>DEVELOPER</option></select></label><div className="form-grid"><label>{user ? 'Reset password' : 'Temporary password'}<input name="password" type="password" required={!user} minLength={user ? undefined : 8} placeholder={user ? 'Leave blank to keep current' : 'At least 8 characters'} autoComplete="new-password"/></label><label>Confirm password<input name="confirmPassword" type="password" required={!user} placeholder="Repeat password" autoComplete="new-password"/></label></div>{error && <div className="form-notice form-notice--error" role="alert">{error}</div>}<div className="form-notice">Only an Admin can create or reset credentials. A new password is temporary and must be changed by the user after first login.</div><div className="dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={submitting}>{submitting ? 'Saving…' : user ? 'Save changes' : 'Add user'} <Icon name="arrow" size={16}/></button></div></form></Dialog>
}

function MemberRequestDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (request: Pick<MemberRequest, 'name' | 'email' | 'reason'>) => Promise<void> }) {
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setSubmitting(true); setError(''); try { await onSubmit({ name: String(form.get('name')).trim(), email: String(form.get('email')).toLowerCase(), reason: String(form.get('reason')).trim() }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to submit this request.') } finally { setSubmitting(false) } }
  return <Dialog title="Request a team member" eyebrow="Admin approval required" onClose={onClose}><form onSubmit={submit}><label>Developer name<input name="name" required placeholder="Proposed team member"/></label><label>Work email<input name="email" type="email" required placeholder="developer@company.com"/></label><label>Business reason<textarea name="reason" rows={4} required minLength={10} placeholder="Which project needs this person and why?"/></label>{error && <div className="form-notice form-notice--error" role="alert">{error}</div>}<div className="approval-note"><Icon name="alert" size={18}/><p>This does not create an account. An Admin must approve the request first.</p></div><div className="dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={submitting}>{submitting ? 'Sending…' : 'Send for approval'} <Icon name="arrow" size={16}/></button></div></form></Dialog>
}

function ApprovalDialog({ request, onClose, onApprove }: { request: MemberRequest; onClose: () => void; onApprove: (password: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password.length < 8) { setError('Set a temporary password with at least 8 characters.'); return }
    if (password !== String(form.get('confirmPassword'))) { setError('The passwords do not match.'); return }
    setSubmitting(true)
    try { await onApprove(password) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to approve this request.') } finally { setSubmitting(false) }
  }
  return <Dialog title={`Approve ${request.name}`} eyebrow="Create developer account" onClose={onClose}><form onSubmit={submit}><div className="approval-note"><Icon name="users" size={18}/><p>{request.email} will receive an active Developer account.</p></div><label>Temporary password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" autoComplete="new-password"/></label><label>Confirm password<input name="confirmPassword" type="password" required placeholder="Repeat password" autoComplete="new-password"/></label>{error && <div className="form-notice form-notice--error" role="alert">{error}</div>}<div className="form-notice">The developer must change this temporary password after first login.</div><div className="dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={submitting}>{submitting ? 'Creating…' : 'Approve & create account'} <Icon name="arrow" size={16}/></button></div></form></Dialog>
}

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (project: Project) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const dueAt = String(form.get('dueAt')); const name = String(form.get('name')); onCreate({ id: `project-${Date.now()}`, name, code: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase() + '-NEW', client: String(form.get('client')), manager: currentManager.name, progress: 0, tasks: 0, overdue: 0, dueDate: todayLabel(dueAt), dueAt, description: String(form.get('description')), status: 'ACTIVE' }) }
  return <Dialog title="Create project" eyebrow="New engagement" onClose={onClose}><form onSubmit={submit}><label>Project name<input name="name" required placeholder="e.g. Mobile platform refresh"/></label><div className="form-grid"><label>Client<select name="client" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option key={client}>{client}</option>)}</select></label><label>Project owner<input value={currentManager.name} disabled/></label></div><label>Description<textarea name="description" required rows={4} placeholder="Project goals and delivery context"/></label><label>Target date <small>Asia/Kolkata</small><input name="dueAt" type="date" min="2026-09-12" required/></label><div className="dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button--primary">Create project <Icon name="arrow" size={16}/></button></div></form></Dialog>
}

function NewTaskDialog({ projectRows, selectedProject, onClose, onCreate }: { projectRows: Project[]; selectedProject: Project | null; onClose: () => void; onCreate: (task: Task) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const project = projectRows.find((item) => item.id === String(form.get('projectId')))!; const developer = people.find((person) => person.id === String(form.get('developerId')))!; const dueAt = String(form.get('dueAt')); onCreate({ id: Math.max(...tasks.map((task) => task.id), 140) + Math.floor(Math.random() * 50), title: String(form.get('title')), description: String(form.get('description')), projectId: project.id, project: project.name, assignee: developer.name, initials: developer.initials, status: 'TO DO', priority: String(form.get('priority')) as Priority, dueDate: todayLabel(dueAt), dueAt }) }
  return <Dialog title="Create & assign task" eyebrow="New work item" onClose={onClose}><form onSubmit={submit}><label>Task title<input name="title" required placeholder="Describe the outcome"/></label><label>Description<textarea name="description" required rows={3} placeholder="Acceptance criteria and implementation context"/></label><div className="form-grid"><label>Project<select name="projectId" required defaultValue={selectedProject?.id ?? ''}><option value="" disabled>Select project</option>{projectRows.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Assign developer<select name="developerId" required defaultValue=""><option value="" disabled>Select developer</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.workload}</option>)}</select></label></div><div className="form-grid"><label>Priority<select name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Due date <small>Asia/Kolkata</small><input name="dueAt" type="date" min="2026-09-12" required/></label></div><div className="dialog-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button--primary">Assign task <Icon name="arrow" size={16}/></button></div></form></Dialog>
}

function AdminWorkspace({ accessToken, users, setUsers, memberRequests, setMemberRequests, onSignOut }: { accessToken: string; users: ManagedUser[]; setUsers: React.Dispatch<React.SetStateAction<ManagedUser[]>>; memberRequests: MemberRequest[]; setMemberRequests: React.Dispatch<React.SetStateAction<MemberRequest[]>>; onSignOut: () => void }) {
  const [view, setView] = useState<AdminView>(() => viewFromPath('/admin', adminViews, 'dashboard'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [taskRows, setTaskRows] = useState<Task[]>(tasks)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(initialActivity)
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>(initialNotifications)
  const [filters, setFilters] = useState<Filters>({ query: '', status: 'ALL', priority: 'ALL', dueFrom: '', dueTo: '' })
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [approvalRequest, setApprovalRequest] = useState<MemberRequest | null>(null)
  const unreadCount = notificationItems.filter((item) => !item.read).length
  const filteredTasks = useMemo(() => taskRows.filter((task) => (filters.status === 'ALL' || task.status === filters.status) && (filters.priority === 'ALL' || task.priority === filters.priority) && (!filters.dueFrom || task.dueAt >= filters.dueFrom) && (!filters.dueTo || task.dueAt <= filters.dueTo) && `${task.title} ${task.project} ${task.assignee}`.toLowerCase().includes(filters.query.toLowerCase())), [filters, taskRows])
  useEffect(() => {
    if (view !== 'tasks') return
    const next = new URLSearchParams()
    if (filters.query) next.set('q', filters.query)
    if (filters.status !== 'ALL') next.set('status', filters.status)
    if (filters.priority !== 'ALL') next.set('priority', filters.priority)
    if (filters.dueFrom) next.set('dueFrom', filters.dueFrom)
    if (filters.dueTo) next.set('dueTo', filters.dueTo)
    window.history.replaceState(null, '', `${window.location.pathname}${next.size ? `?${next}` : ''}`)
  }, [filters, view])
  useEffect(() => {
    const onPopState = () => setView(viewFromPath('/admin', adminViews, 'dashboard'))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const changeStatus = (task: Task, status: TaskStatus) => { if (task.status === status) return; const previous = task.status; setTaskRows((rows) => rows.map((row) => row.id === task.id ? { ...row, status } : row)); setActivityItems((rows) => [{ id: Date.now(), initials: currentAdmin.initials, actor: currentAdmin.name, action: `moved Task #${task.id} from ${previous} to ${status}`, time: 'just now', tone: 'blue' }, ...rows] as ActivityItem[]) }
  const saveUser = async (user: ManagedUser) => {
    const role = user.role === 'PROJECT MANAGER' ? 'PROJECT_MANAGER' : user.role
    const body = user.id ? { name: user.name, email: user.email, ...(user.role === 'ADMIN' ? {} : { role }), ...(user.password ? { password: user.password } : {}) } : { name: user.name, email: user.email, role, password: user.password }
    const saved = await apiRequest<ApiUser>(user.id ? `/users/${user.id}` : '/users', { method: user.id ? 'PATCH' : 'POST', body: JSON.stringify(body) }, accessToken)
    const mapped = apiUserToManaged(saved)
    setUsers((rows) => rows.some((row) => row.id === mapped.id) ? rows.map((row) => row.id === mapped.id ? mapped : row) : [...rows, mapped])
    setUserDialogOpen(false); setEditingUser(null)
  }
  const updateRequest = async (request: MemberRequest, status: MemberRequest['status'], password = '') => {
    await apiRequest(`/member-requests/${request.id}`, { method: 'PATCH', body: JSON.stringify(status === 'APPROVED' ? { status, temporaryPassword: password } : { status }) }, accessToken)
    setMemberRequests((rows) => rows.map((row) => row.id === request.id ? { ...row, status } : row))
    if (status === 'APPROVED') setUsers((await apiRequest<ApiUser[]>('/users', {}, accessToken)).map(apiUserToManaged))
  }
  const toggleUser = async (user: ManagedUser) => {
    const saved = await apiRequest<ApiUser>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: user.status !== 'ACTIVE' }) }, accessToken)
    const mapped = apiUserToManaged(saved); setUsers((rows) => rows.map((row) => row.id === mapped.id ? mapped : row))
  }
  const navigate = (next: AdminView) => { setView(next); routeTo(workspacePath('/admin', next)); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const adminNav = [{ id: 'dashboard', label: 'Overview', icon: 'grid' }, { id: 'projects', label: 'All projects', icon: 'folder' }, { id: 'tasks', label: 'All tasks', icon: 'check' }, { id: 'clients', label: 'Clients', icon: 'building' }, { id: 'users', label: 'Team & roles', icon: 'users' }, { id: 'activity', label: 'Global activity', icon: 'pulse' }] as const
  const copy: Record<AdminView, { eyebrow: string; title: string; description: string }> = {
    dashboard: { eyebrow: 'Friday · 12 Sep 2026', title: 'Global operations.', description: 'Every project, task, user, and delivery signal across the agency.' },
    projects: { eyebrow: 'Agency portfolio', title: 'All projects', description: 'Administrator access across every project manager and client.' },
    tasks: { eyebrow: 'Global work queue', title: 'All tasks', description: 'Filter and manage tasks across the full organization.' },
    clients: { eyebrow: 'Client directory', title: 'Clients', description: 'Manage client records and connected engagements.' },
    users: { eyebrow: 'Access control', title: 'Team & roles', description: 'Manage user access, roles, and account status.' },
    activity: { eyebrow: 'Organization audit trail', title: 'Global activity', description: 'Live updates across every project and user.' },
  }
  return <div className="app-shell admin-shell"><aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}><div className="sidebar-brand"><Logo/><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close"/></button></div><div className="workspace-chip"><Avatar initials="AV" tone="blue"/><div><strong>Anika's console</strong><span>Administrator</span></div></div><nav aria-label="Administrator navigation">{adminNav.map((item, index) => <button key={item.id} className={view === item.id ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => navigate(item.id)}><span className="nav-index">0{index + 1}</span><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className="sidebar-foot"><span className="live-label"><i/> Systems operational</span><button onClick={onSignOut}><Icon name="logout" size={16}/> Sign out</button></div></aside>{menuOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}<main className="workspace-main"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbar-label"><span>Administrator console</span><strong>Global access</strong></div><div className="topbar-actions"><span className="connection-label"><i/> Live · 6 online</span><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label={`Notifications, ${unreadCount} unread`}><Icon name="bell"/>{unreadCount > 0 && <span>{unreadCount}</span>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-title"><div><strong>Notifications</strong><span>{unreadCount} unread</span></div><button onClick={() => setNotificationItems((rows) => rows.map((item) => ({ ...item, read: true })))}>Mark all read</button></div>{notificationItems.map((item) => <article className={item.read ? 'notification-read' : ''} key={item.id}><span className={`notification-dot notification-dot--${item.tone}`}/><div><strong>{item.title}</strong><p>{item.body}</p><time>{item.time}</time></div>{!item.read && <button onClick={() => setNotificationItems((rows) => rows.map((row) => row.id === item.id ? { ...row, read: true } : row))}>Mark read</button>}</article>)}</div>}</div><div className="manager-profile"><Avatar initials="AV" tone="blue"/><div><strong>{currentAdmin.name}</strong><span>Administrator</span></div></div></div></header><div className="page"><header className="page-header"><div><span className="eyebrow">{copy[view].eyebrow}</span><h1>{copy[view].title}</h1><p>{copy[view].description}</p></div>{view === 'users' && <button className="button button--primary" onClick={() => { setEditingUser(null); setUserDialogOpen(true) }}><Icon name="plus" size={16}/> Add team member</button>}</header>
    {view === 'dashboard' && <><section className="pm-summary admin-summary"><article className="hero-metric"><span>TOTAL PROJECTS</span><strong>{projects.length}</strong><small>Across 2 managers</small></article><article><span>OPEN TASKS</span><strong>{taskRows.filter((task) => task.status !== 'DONE').length}</strong><small>{taskRows.filter((task) => task.status === 'IN REVIEW').length} in review</small></article><article className="danger-metric"><span>OVERDUE</span><strong>{taskRows.filter((task) => task.overdue).length}</strong><small>Requires attention</small></article><article className="week-metric"><span>ONLINE NOW</span><strong>6</strong><small>of {users.length} active users</small></article></section><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="section-index">01</span><h2>Portfolio health</h2></div><button className="text-button" onClick={() => navigate('projects')}>All projects <Icon name="arrow" size={15}/></button></div><div className="project-stack">{projects.map((project) => <button className="project-row" key={project.id} onClick={() => navigate('projects')}><span className="project-number">{project.code.slice(-2)}</span><span className="project-main"><span><strong>{project.name}</strong><small>{project.client} · {project.manager}</small></span><Progress value={project.progress}/></span><span className="project-progress"><strong>{project.progress}%</strong><small>{project.tasks} tasks</small></span><Badge tone={project.status.toLowerCase().replaceAll(' ', '-')}>{project.status}</Badge><Icon name="chevron" size={17}/></button>)}</div></section><aside className="panel activity-panel"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE</span><h2>Global activity</h2></div></div><ActivityFeed items={activityItems}/></aside></div></>}
    {view === 'projects' && <section className="panel"><div className="table-scroll"><table><thead><tr><th>Project</th><th>Client</th><th>Manager</th><th>Progress</th><th>Target</th><th>Health</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><span className="task-id">{project.code}</span><strong>{project.name}</strong></td><td>{project.client}</td><td>{project.manager}</td><td>{project.progress}%</td><td>{project.dueDate}</td><td><Badge tone={project.status.toLowerCase().replaceAll(' ', '-')}>{project.status}</Badge></td></tr>)}</tbody></table></div></section>}
    {view === 'tasks' && <section className="panel"><TaskFilters filters={filters} onChange={setFilters} resultCount={filteredTasks.length}/><TaskTable rows={filteredTasks} onStatusChange={changeStatus}/></section>}
    {view === 'clients' && <section className="admin-card-grid">{clients.map((client, index) => <article className="admin-directory-card" key={client}><span className="card-index">0{index + 1}</span><Icon name="building" size={22}/><h2>{client}</h2><p>{projects.filter((project) => project.client === client).length} active engagement(s)</p><button className="text-button">Manage client <Icon name="arrow" size={14}/></button></article>)}</section>}
    {view === 'users' && <div className="user-management"><section className="panel approval-panel"><div className="panel-heading"><div><span className="section-index">APPROVALS / {memberRequests.filter((request) => request.status === 'PENDING').length}</span><h2>PM member requests</h2></div></div>{memberRequests.length === 0 ? <div className="empty-state"><strong>No member requests</strong><span>Requests submitted by project managers appear here.</span></div> : <div className="request-list">{memberRequests.map((request) => <article key={request.id}><div><Badge tone={request.status.toLowerCase()}>{request.status}</Badge><strong>{request.name}</strong><span>{request.email} · requested by {request.requestedBy}</span><p>{request.reason}</p></div>{request.status === 'PENDING' && <div><button className="button button--small" onClick={() => updateRequest(request, 'REJECTED')}>Reject</button><button className="button button--primary button--small" onClick={() => setApprovalRequest(request)}>Approve</button></div>}</article>)}</div>}</section><section className="panel"><div className="panel-heading"><div><span className="section-index">USERS / {users.length}</span><h2>Account directory</h2></div></div><div className="table-scroll"><table><thead><tr><th>Person</th><th>Email</th><th>Role</th><th>Credentials</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td><span className="person-cell"><Avatar initials={person.initials}/><strong>{person.name}</strong></span></td><td>{person.email}</td><td><Badge>{person.role}</Badge></td><td><Badge tone={person.mustChangePassword ? 'pending' : 'active'}>{person.mustChangePassword ? 'RESET REQUIRED' : 'PASSWORD SET'}</Badge></td><td><Badge tone={person.status === 'ACTIVE' ? 'active' : 'neutral'}>{person.status}</Badge></td><td><span className="row-actions"><button onClick={() => { setEditingUser(person); setUserDialogOpen(true) }}>{person.role === 'ADMIN' ? 'Edit' : 'Edit / Reset'}</button>{person.role !== 'ADMIN' && <><button onClick={() => void toggleUser(person)}>{person.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></>}</span></td></tr>)}</tbody></table></div></section></div>}
    {view === 'activity' && <section className="activity-page"><div className="activity-summary"><div><span>TODAY</span><strong>18</strong><small>global events</small></div><div><span>ONLINE</span><strong>6</strong><small>active users</small></div><div><span>SCOPE</span><strong>ALL</strong><small>projects</small></div></div><section className="panel"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE FEED</span><h2>Latest changes</h2></div></div><ActivityFeed items={activityItems} full/></section></section>}
  </div></main>{userDialogOpen && <UserDialog user={editingUser} onClose={() => { setUserDialogOpen(false); setEditingUser(null) }} onSave={saveUser}/>} {approvalRequest && <ApprovalDialog request={approvalRequest} onClose={() => setApprovalRequest(null)} onApprove={async (password) => { await updateRequest(approvalRequest, 'APPROVED', password); setApprovalRequest(null) }}/>}</div>
}

function DeveloperWorkspace({ onSignOut }: { onSignOut: () => void }) {
  const [view, setView] = useState<DeveloperView>(() => viewFromPath('/developer', developerViews, 'dashboard'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [taskRows, setTaskRows] = useState<Task[]>(() => tasks.filter((task) => task.assignee === currentDeveloper.name).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueAt.localeCompare(b.dueAt)))
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([
    initialActivity[0], initialActivity[2],
    { id: 801, initials: 'MC', actor: 'Maya Chen', action: 'assigned Task #129 to you', time: 'yesterday', tone: 'blue' },
    { id: 802, initials: 'AS', actor: 'Aarav Shah', action: 'completed Task #88 in Member Portal', time: '2 days ago', tone: 'green' },
  ])
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([
    { id: 701, title: 'New task assigned', body: 'Maya assigned #124 to you.', time: '2 hr ago', read: false, tone: 'orange' },
    { id: 702, title: 'Due today', body: '#124 is due today at 6:00 PM.', time: '4 hr ago', read: false, tone: 'red' },
    { id: 703, title: 'Status acknowledged', body: 'Maya reviewed your update on #129.', time: 'yesterday', read: true, tone: 'green' },
  ])
  const params = new URLSearchParams(window.location.search)
  const [filters, setFilters] = useState<Filters>({ query: params.get('q') ?? '', status: (params.get('status') as Filters['status']) ?? 'ALL', priority: (params.get('priority') as Filters['priority']) ?? 'ALL', dueFrom: params.get('dueFrom') ?? '', dueTo: params.get('dueTo') ?? '' })
  const filteredTasks = useMemo(() => taskRows.filter((task) => (filters.status === 'ALL' || task.status === filters.status) && (filters.priority === 'ALL' || task.priority === filters.priority) && (!filters.dueFrom || task.dueAt >= filters.dueFrom) && (!filters.dueTo || task.dueAt <= filters.dueTo) && `${task.title} ${task.project}`.toLowerCase().includes(filters.query.toLowerCase())).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueAt.localeCompare(b.dueAt)), [filters, taskRows])
  const openTasks = taskRows.filter((task) => task.status !== 'DONE')
  const focusTasks = openTasks.slice().sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueAt.localeCompare(b.dueAt))
  const unreadCount = notificationItems.filter((item) => !item.read).length
  const completeCount = taskRows.filter((task) => task.status === 'DONE').length

  useEffect(() => {
    if (view !== 'tasks') return
    const next = new URLSearchParams()
    if (filters.query) next.set('q', filters.query)
    if (filters.status !== 'ALL') next.set('status', filters.status)
    if (filters.priority !== 'ALL') next.set('priority', filters.priority)
    if (filters.dueFrom) next.set('dueFrom', filters.dueFrom)
    if (filters.dueTo) next.set('dueTo', filters.dueTo)
    window.history.replaceState(null, '', `${window.location.pathname}${next.size ? `?${next}` : ''}`)
  }, [filters, view])

  useEffect(() => {
    const onPopState = () => setView(viewFromPath('/developer', developerViews, 'dashboard'))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (next: typeof view) => { setView(next); routeTo(workspacePath('/developer', next)); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const changeStatus = (task: Task, status: TaskStatus) => {
    if (task.status === status) return
    const previous = task.status
    setTaskRows((rows) => rows.map((row) => row.id === task.id ? { ...row, status } : row))
    setActivityItems((rows) => [{ id: Date.now(), initials: currentDeveloper.initials, actor: currentDeveloper.name, action: `moved Task #${task.id} from ${previous} to ${status}`, time: 'just now', tone: status === 'DONE' ? 'green' : 'orange' }, ...rows] as ActivityItem[])
  }
  const copy = {
    dashboard: { eyebrow: 'Friday · 12 Sep 2026', title: 'Your focus, Aarav.', description: 'Assigned work only, ordered by priority and deadline.' },
    tasks: { eyebrow: 'Personal delivery queue', title: 'My tasks', description: 'Update status and filter the work currently assigned to you.' },
    activity: { eyebrow: 'Your audit trail', title: 'My activity', description: 'Status changes and assignments for your tasks only.' },
  }[view]
  const developerNav = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: 'grid' as const },
    { id: 'tasks' as const, label: 'My tasks', icon: 'check' as const },
    { id: 'activity' as const, label: 'My activity', icon: 'pulse' as const },
  ]

  return <div className="app-shell developer-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}><div className="sidebar-brand"><Logo/><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close"/></button></div><div className="workspace-chip"><Avatar initials="AS" tone="lime"/><div><strong>Aarav's workspace</strong><span>Developer</span></div></div><nav aria-label="Developer navigation">{developerNav.map((item, index) => <button key={item.id} className={view === item.id ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => navigate(item.id)}><span className="nav-index">0{index + 1}</span><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className="sidebar-scope"><span>ACCESS SCOPE</span><strong>Assigned tasks only</strong><p>Other developers' work is private.</p></div><div className="sidebar-foot"><span className="live-label"><i/> Realtime connected</span><button onClick={onSignOut}><Icon name="logout" size={16}/> Sign out</button></div></aside>
    {menuOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}<main className="workspace-main"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbar-label"><span>Developer workspace</span><strong>Assigned tasks only</strong></div><div className="topbar-actions"><span className="connection-label"><i/> Live</span><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label={`Notifications, ${unreadCount} unread`}><Icon name="bell"/>{unreadCount > 0 && <span>{unreadCount}</span>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-title"><div><strong>Notifications</strong><span>{unreadCount} unread</span></div><button onClick={() => setNotificationItems((rows) => rows.map((item) => ({ ...item, read: true })))}>Mark all read</button></div>{notificationItems.map((item) => <article className={item.read ? 'notification-read' : ''} key={item.id}><span className={`notification-dot notification-dot--${item.tone}`}/><div><strong>{item.title}</strong><p>{item.body}</p><time>{item.time}</time></div>{!item.read && <button onClick={() => setNotificationItems((rows) => rows.map((row) => row.id === item.id ? { ...row, read: true } : row))}>Mark read</button>}</article>)}<button className="wide-link" onClick={() => { setNotificationsOpen(false); navigate('activity') }}>Open my activity <Icon name="arrow" size={14}/></button></div>}</div><div className="manager-profile"><Avatar initials="AS" tone="lime"/><div><strong>{currentDeveloper.name}</strong><span>Developer</span></div></div></div></header>
      <div className="page"><header className="page-header"><div><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div>{view !== 'activity' && <button className="button button--primary" onClick={() => navigate('tasks')}>Open my queue <Icon name="arrow" size={16}/></button>}</header>
        {view === 'dashboard' && <><section className="pm-summary developer-summary" aria-label="Developer task summary"><article className="hero-metric"><span>ASSIGNED TO ME</span><strong>{taskRows.length}</strong><small>Across {new Set(taskRows.map((task) => task.projectId)).size} projects</small></article><article><span>IN PROGRESS</span><strong>{taskRows.filter((task) => task.status === 'IN PROGRESS').length}</strong><small>Active work</small></article><article className="danger-metric"><span>DUE TODAY</span><strong>{taskRows.filter((task) => task.dueAt === '2026-09-12' && task.status !== 'DONE').length}</strong><small>Finish or raise a blocker</small></article><article className="week-metric"><span>COMPLETED</span><strong>{completeCount}</strong><small>{Math.round(completeCount / taskRows.length * 100)}% of assigned tasks</small></article></section><div className="developer-focus-grid"><section className="panel"><div className="panel-heading"><div><span className="section-index">01</span><h2>Priority queue</h2></div><button className="text-button" onClick={() => navigate('tasks')}>All my tasks <Icon name="arrow" size={15}/></button></div><TaskTable rows={focusTasks} onStatusChange={changeStatus}/></section><aside className="developer-spotlight"><span className="section-index">NEXT UP / #{focusTasks[0]?.id}</span><div><Badge tone={focusTasks[0]?.priority.toLowerCase()}>{focusTasks[0]?.priority}</Badge><h2>{focusTasks[0]?.title}</h2><p>{focusTasks[0]?.description}</p></div><dl><div><dt>Project</dt><dd>{focusTasks[0]?.project}</dd></div><div><dt>Due</dt><dd>{focusTasks[0]?.dueDate}</dd></div></dl><label>Quick status<select value={focusTasks[0]?.status} onChange={(event) => focusTasks[0] && changeStatus(focusTasks[0], event.target.value as TaskStatus)}><option>TO DO</option><option>IN PROGRESS</option><option>IN REVIEW</option><option>DONE</option></select></label></aside></div><section className="panel developer-activity-strip"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE</span><h2>My latest activity</h2></div><span className="live-label"><i/> Connected</span></div><ActivityFeed items={activityItems.slice(0, 4)}/></section></>}
        {view === 'tasks' && <section className="panel"><TaskFilters filters={filters} onChange={setFilters} resultCount={filteredTasks.length}/><TaskTable rows={filteredTasks} onStatusChange={changeStatus}/></section>}
        {view === 'activity' && <section className="activity-page"><div className="activity-summary"><div><span>MY EVENTS</span><strong>{activityItems.length}</strong><small>recent updates</small></div><div><span>ASSIGNED</span><strong>{taskRows.length}</strong><small>visible tasks</small></div><div><span>ACCESS</span><strong>1</strong><small>developer scope</small></div></div><section className="panel"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE FEED</span><h2>Assigned-task changes</h2></div><span className="live-label"><i/> Connected</span></div><ActivityFeed items={activityItems} full/></section></section>}
      </div></main>
  </div>
}

function App() {
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(initialManagedUsers)
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([])
  const [view, setView] = useState<View>(() => viewFromPath('/pm', pmViews, 'dashboard'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectRows, setProjectRows] = useState<Project[]>(ownedSeedProjects)
  const [taskRows, setTaskRows] = useState<Task[]>(ownedSeedTasks)
  const [activityItems, setActivityItems] = useState(initialActivity)
  const [notificationItems, setNotificationItems] = useState(initialNotifications)
  const params = new URLSearchParams(window.location.search)
  const [filters, setFilters] = useState<Filters>({ query: params.get('q') ?? '', status: (params.get('status') as Filters['status']) ?? 'ALL', priority: (params.get('priority') as Filters['priority']) ?? 'ALL', dueFrom: params.get('dueFrom') ?? '', dueTo: params.get('dueTo') ?? '' })

  useEffect(() => {
    if (view !== 'tasks' || workspaceRole !== 'PM') return
    const next = new URLSearchParams()
    if (filters.query) next.set('q', filters.query)
    if (filters.status !== 'ALL') next.set('status', filters.status)
    if (filters.priority !== 'ALL') next.set('priority', filters.priority)
    if (filters.dueFrom) next.set('dueFrom', filters.dueFrom)
    if (filters.dueTo) next.set('dueTo', filters.dueTo)
    window.history.replaceState(null, '', `${window.location.pathname}${next.size ? `?${next}` : ''}`)
  }, [filters, view, workspaceRole])

  useEffect(() => {
    const onPopState = () => {
      if (workspaceRole === 'PM') setView(viewFromPath('/pm', pmViews, 'dashboard'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [workspaceRole])

  useEffect(() => {
    if (!workspaceRole || !accessToken) return
    void (async () => {
      try {
        const requests = await apiRequest<ApiMemberRequest[]>('/member-requests', {}, accessToken)
        setMemberRequests(requests.map(apiRequestToMember))
        if (workspaceRole === 'ADMIN') setManagedUsers((await apiRequest<ApiUser[]>('/users', {}, accessToken)).map(apiUserToManaged))
      } catch (reason) {
        console.error('Unable to load account data', reason)
      }
    })()
  }, [accessToken, workspaceRole])

  const filteredTasks = useMemo(() => taskRows.filter((task) => (filters.status === 'ALL' || task.status === filters.status) && (filters.priority === 'ALL' || task.priority === filters.priority) && (!filters.dueFrom || task.dueAt >= filters.dueFrom) && (!filters.dueTo || task.dueAt <= filters.dueTo) && `${task.title} ${task.project} ${task.assignee}`.toLowerCase().includes(filters.query.toLowerCase())).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueAt.localeCompare(b.dueAt)), [filters, taskRows])
  const copy = selectedProject ? null : pageCopy[view]
  const unreadCount = notificationItems.filter((item) => !item.read).length
  const navigate = (next: View) => { setView(next); routeTo(workspacePath('/pm', next)); setSelectedProject(null); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const changeStatus = (task: Task, status: TaskStatus) => { if (task.status === status) return; const previous = task.status; setTaskRows((rows) => rows.map((row) => row.id === task.id ? { ...row, status } : row)); setActivityItems((rows) => [{ id: Date.now(), initials: currentManager.initials, actor: currentManager.name, action: `moved Task #${task.id} from ${previous.replaceAll('_', ' ')} to ${status.replaceAll('_', ' ')}`, time: 'just now', tone: 'orange' }, ...rows] as ActivityItem[]); if (status === 'IN REVIEW') setNotificationItems((rows) => [{ id: Date.now(), title: 'Task ready for review', body: `#${task.id} moved to In Review.`, time: 'just now', read: false, tone: 'orange' }, ...rows] as NotificationItem[]) }
  const createProject = (project: Project) => { setProjectRows((rows) => [project, ...rows]); setActivityItems((rows) => [{ id: Date.now(), initials: currentManager.initials, actor: currentManager.name, action: `created project ${project.name}`, time: 'just now', tone: 'blue' }, ...rows] as ActivityItem[]); setProjectDialogOpen(false); setSelectedProject(project) }
  const createTask = (task: Task) => { setTaskRows((rows) => [task, ...rows]); setProjectRows((rows) => rows.map((project) => project.id === task.projectId ? { ...project, tasks: project.tasks + 1 } : project)); setActivityItems((rows) => [{ id: Date.now(), initials: currentManager.initials, actor: currentManager.name, action: `assigned Task #${task.id} to ${task.assignee}`, time: 'just now', tone: 'lime' }, ...rows] as ActivityItem[]); setTaskDialogOpen(false) }

  const authenticate = (role: WorkspaceRole, token = '') => { setAccessToken(token); setWorkspaceRole(role); routeTo(roleRoot[role], true) }
  const signOut = () => { setAccessToken(''); setWorkspaceRole(null); routeTo('/login', true) }

  if (!workspaceRole) return <AuthScreen onAuthenticate={authenticate} onAdminSetup={(user) => { setManagedUsers((rows) => [...rows, user]); authenticate('ADMIN') }}/>
  if (workspaceRole === 'ADMIN') return <AdminWorkspace accessToken={accessToken} users={managedUsers} setUsers={setManagedUsers} memberRequests={memberRequests} setMemberRequests={setMemberRequests} onSignOut={signOut}/>
  if (workspaceRole === 'DEVELOPER') return <DeveloperWorkspace onSignOut={signOut}/>
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}><div className="sidebar-brand"><Logo/><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close"/></button></div><div className="workspace-chip"><Avatar initials="MC" tone="orange"/><div><strong>Maya's workspace</strong><span>Project manager</span></div></div><nav aria-label="Main navigation">{navItems.map((item, index) => <button key={item.id} className={view === item.id && !selectedProject ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => navigate(item.id)}><span className="nav-index">0{index + 1}</span><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className="sidebar-foot"><span className="live-label"><i/> Realtime connected</span><button onClick={signOut}><Icon name="logout" size={16}/> Sign out</button></div></aside>
    {menuOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}<main className="workspace-main"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbar-label"><span>Project manager workspace</span><strong>Owned projects only</strong></div><div className="topbar-actions"><span className="connection-label"><i/> Live</span><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label={`Notifications, ${unreadCount} unread`}><Icon name="bell"/>{unreadCount > 0 && <span>{unreadCount}</span>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-title"><div><strong>Notifications</strong><span>{unreadCount} unread</span></div><button onClick={() => setNotificationItems((rows) => rows.map((item) => ({ ...item, read: true })))}>Mark all read</button></div>{notificationItems.map((item) => <article className={item.read ? 'notification-read' : ''} key={item.id}><span className={`notification-dot notification-dot--${item.tone}`}/><div><strong>{item.title}</strong><p>{item.body}</p><time>{item.time}</time></div>{!item.read && <button onClick={() => setNotificationItems((rows) => rows.map((row) => row.id === item.id ? { ...row, read: true } : row))}>Mark read</button>}</article>)}<button className="wide-link" onClick={() => { setNotificationsOpen(false); navigate('activity') }}>Open activity log <Icon name="arrow" size={14}/></button></div>}</div><div className="manager-profile"><Avatar initials="MC" tone="orange"/><div><strong>{currentManager.name}</strong><span>Project Manager</span></div></div></div></header>
      <div className="page">{selectedProject ? <ProjectDetail project={selectedProject} rows={taskRows.filter((task) => task.projectId === selectedProject.id)} activityItems={activityItems.slice(0, 5)} onBack={() => setSelectedProject(null)} onNewTask={() => setTaskDialogOpen(true)} onStatusChange={changeStatus}/> : <><header className="page-header"><div><span className="eyebrow">{copy!.eyebrow}</span><h1>{copy!.title}</h1><p>{copy!.description}</p></div>{view !== 'activity' && <div className="page-actions"><button className="button" onClick={() => setRequestDialogOpen(true)}><Icon name="users" size={17}/> Request member {memberRequests.filter((request) => request.requestedBy === currentManager.name && request.status === 'PENDING').length > 0 && <span className="button-count">{memberRequests.filter((request) => request.requestedBy === currentManager.name && request.status === 'PENDING').length}</span>}</button>{view !== 'projects' && <button className="button" onClick={() => setTaskDialogOpen(true)}><Icon name="check" size={17}/> New task</button>}<button className="button button--primary" onClick={() => setProjectDialogOpen(true)}><Icon name="plus" size={17}/> New project</button></div>}</header>{view === 'dashboard' && <Dashboard projectRows={projectRows} taskRows={taskRows} activityItems={activityItems} onNavigate={navigate} onStatusChange={changeStatus} onOpenProject={setSelectedProject}/>} {view === 'projects' && <ProjectsPage rows={projectRows} onOpen={setSelectedProject} onCreate={() => setProjectDialogOpen(true)}/>} {view === 'tasks' && <section className="panel"><TaskFilters filters={filters} onChange={setFilters} resultCount={filteredTasks.length}/><TaskTable rows={filteredTasks} onStatusChange={changeStatus}/></section>} {view === 'activity' && <section className="activity-page"><div className="activity-summary"><div><span>TODAY</span><strong>{activityItems.length + 13}</strong><small>events recorded</small></div><div><span>TEAM ONLINE</span><strong>4 / 4</strong><small>active developers</small></div><div><span>SCOPE</span><strong>{projectRows.length}</strong><small>owned projects</small></div></div><section className="panel"><div className="panel-heading"><div><span className="section-index section-index--live">LIVE FEED</span><h2>Latest changes</h2></div><span className="live-label"><i/> Connected</span></div><ActivityFeed items={activityItems} full/></section></section>}</>}</div>
    </main>
    {projectDialogOpen && <NewProjectDialog onClose={() => setProjectDialogOpen(false)} onCreate={createProject}/>} {taskDialogOpen && <NewTaskDialog projectRows={projectRows} selectedProject={selectedProject} onClose={() => setTaskDialogOpen(false)} onCreate={createTask}/>} {requestDialogOpen && <MemberRequestDialog onClose={() => setRequestDialogOpen(false)} onSubmit={async (request) => { const created = await apiRequest<ApiMemberRequest>('/member-requests', { method: 'POST', body: JSON.stringify(request) }, accessToken); setMemberRequests((rows) => [apiRequestToMember(created), ...rows]); setRequestDialogOpen(false) }}/>} 
  </div>
}

export default App
