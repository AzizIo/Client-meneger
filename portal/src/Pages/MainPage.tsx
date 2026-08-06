import API from '../API/api'
import Header from '../Components/Header'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StageStepper from '../Components/Stagesstepper'

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | undefined;
  role: string;
  create_at: string;
}

interface Project {
  id: string;
  executor_id: string;
  client_id: string;
  name: string;
  description: string;
  status: string;
  is_archived: boolean
  stages: {
    id: string;
    project_id: string;
    name: string;
    position: number;
    status: string;
    created_at: string;
  }[]
}

interface Assignee {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface PendingApprovalTask {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  stage_id: string;
  status: string;
  created_at: string;
  assignee?: Assignee;
}

// ── Токены направления ──────────────────────────────────────────
// ink        #1C1B19  — чернильный текст вместо чёрного
// paper      #FAFAF8  — тёплый "бумажный" фон
// line       #DDDAD3  — hairline-разделители
// stamp-blue #2C4A8C  — акцент, "штамп корректора"
// stamp-red  #A23B2E  — акцент для "на паузе"/отклонено
// muted      #8A8681  — второстепенный текст

const STATUS_STAMP: Record<string, { label: string; tone: 'ink' | 'blue' | 'red' }> = {
  active: { label: 'В работе', tone: 'blue' },
  completed: { label: 'Завершён', tone: 'ink' },
  on_hold: { label: 'На паузе', tone: 'red' },
};

function getStatusStamp(status: string) {
  return STATUS_STAMP[status] ?? { label: status, tone: 'ink' as const };
}

const toneClasses: Record<'ink' | 'blue' | 'red', string> = {
  ink: 'border-[#1C1B19] text-[#1C1B19]',
  blue: 'border-[#2C4A8C] text-[#2C4A8C]',
  red: 'border-[#A23B2E] text-[#A23B2E]',
};

// Штамп статуса — повёрнутая рамка с моноширинным текстом.
// Единственный акцентный приём страницы, встречается в статах,
// проектах и задачах на согласование — это и есть "подпись" дизайна.
function StampBadge({ label, tone = 'ink' }: { label: string; tone?: 'ink' | 'blue' | 'red' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border-[1.5px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider -rotate-2 whitespace-nowrap ${toneClasses[tone]}`}
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {label}
    </span>
  );
}

// Crop-mark уголки — типографские метки реза, проявляются на hover.
// Отсылка к "проверке работы перед сдачей", ключевая тема продукта.
function CornerMarks() {
  return (
    <>
      <span className="pointer-events-none absolute -top-px -left-px h-3 w-3 border-t-[1.5px] border-l-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -top-px -right-px h-3 w-3 border-t-[1.5px] border-r-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b-[1.5px] border-l-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-[1.5px] border-r-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8A8681]"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {children}
    </p>
  );
}

export default function MainPage() {
  const [me, setMe] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalTask[]>([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)
  function TaskAiSummary({ taskId }: { taskId: string }) {
    const [summary, setSummary] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      let cancelled = false
      API.get(`/tasks/${taskId}/ai-summary`)
        .then(res => { if (!cancelled) setSummary(res.data.summary) })
        .catch(() => { if (!cancelled) setSummary(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }, [taskId])

    if (loading) {
      return (
        <p
          className='text-xs mt-2 italic'
          style={{ color: '#8A8681', fontFamily: "'IBM Plex Mono', monospace" }}
        >
          ✦ ассистент анализирует...
        </p>
      )
    }

    if (!summary) return null

    return (
      <p
        className='text-xs mt-2 leading-relaxed'
        style={{ color: '#2C4A8C', fontFamily: "'IBM Plex Mono', monospace" }}
      >
        ✦ {summary}
      </p>
    )
  }
  useEffect(() => {
    API.get('/auth/me')
      .then(res => setMe(res.data))
      .catch(err => console.log(err.response?.data))
    API.get('/projects')
      .then(res => setProjects(res.data))
      .catch(err => console.log(err.response?.data))
  }, [])

  useEffect(() => {
    if (me?.role !== 'client') return

    setLoadingApprovals(true)
    API.get('/dashboard/pending-approvals')
      .then(res => setPendingApprovals(res.data))
      .catch(err => console.log(err.response?.data))
      .finally(() => setLoadingApprovals(false))
  }, [me])

  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const stats = [
    { label: 'Всего проектов', value: projects.length },
    { label: 'Активные', value: projects.filter(p => p.status === 'active').length },
    { label: 'Завершённые', value: projects.filter(p => p.status === 'completed').length },
    { label: 'На паузе', value: projects.filter(p => p.status === 'on_hold').length },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Header />
      <main className='container mx-auto px-6 py-10 space-y-12'>
        <section>
          <Eyebrow>Дашборд · {today}</Eyebrow>
          <h1
            className="mt-2 text-3xl font-semibold"
            style={{ color: '#1C1B19', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Добро пожаловать, {me ? me.full_name : "..."}
          </h1>
        </section>

        <section>
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className='group relative rounded-md bg-white p-5 flex flex-col justify-between'
                style={{ border: '1px solid #DDDAD3' }}
              >
                <CornerMarks />
                <Eyebrow>{String(i + 1).padStart(2, '0')} · {stat.label}</Eyebrow>
                <p
                  className="mt-3 text-3xl font-semibold"
                  style={{ color: '#1C1B19', fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {me?.role === 'client' && (
          <section>
            <div className='flex items-center gap-2 mb-4'>
              <h2
                className='text-lg font-semibold'
                style={{ color: '#1C1B19', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Ожидают вашего согласования
              </h2>
              {pendingApprovals.length > 0 && (
                <StampBadge label={String(pendingApprovals.length)} tone="blue" />
              )}
            </div>

            {loadingApprovals ? (
              <p className='text-sm' style={{ color: '#8A8681' }}>Загрузка...</p>
            ) : pendingApprovals.length === 0 ? (
              <div
                className='rounded-md bg-white p-6 text-sm text-center'
                style={{ border: '1px solid #DDDAD3', color: '#8A8681' }}
              >
                Нет задач, ожидающих согласования
              </div>
            ) : (
              <div className='space-y-2'>
                {pendingApprovals.map(task => (
                  <Link key={task.id} to={`/projects/${task.project_id}?stage=${task.stage_id}&task=${task.id}`} className='block'>
                    <div
                      className='group relative rounded-md bg-white hover:shadow-sm transition-shadow p-4 flex items-center justify-between gap-4'
                      style={{ border: '1px solid #DDDAD3' }}
                    >
                      <CornerMarks />
                      <div className='flex-1 min-w-0'>
                        <div className='flex-1 min-w-0'>
                          <h3 className='text-sm font-medium truncate' style={{ color: '#1C1B19' }}>{task.title}</h3>
                          {task.description && (
                            <p className='text-sm mt-0.5 line-clamp-1' style={{ color: '#8A8681' }}>
                              {task.description}
                            </p>
                          )}
                          <p className='text-xs mt-1.5' style={{ color: '#8A8681', fontFamily: "'IBM Plex Mono', monospace" }}>
                            {task.assignee ? `${task.assignee.full_name} · ` : ''}
                            {new Date(task.created_at).toLocaleDateString('ru-RU')}
                          </p>
                          <TaskAiSummary taskId={task.id} />
                        </div>
                        <h3 className='text-sm font-medium truncate' style={{ color: '#1C1B19' }}>{task.title}</h3>
                        {task.description && (
                          <p className='text-sm mt-0.5 line-clamp-1' style={{ color: '#8A8681' }}>
                            {task.description}
                          </p>
                        )}
                        <p className='text-xs mt-1.5' style={{ color: '#8A8681', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {task.assignee ? `${task.assignee.full_name} · ` : ''}
                          {new Date(task.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <StampBadge label="На согласовании" tone="blue" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2
            className='text-lg font-semibold mb-4'
            style={{ color: '#1C1B19', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Ваши проекты
          </h2>

          {projects.length === 0 ? (
            <div
              className='rounded-md bg-white p-6 text-sm text-center'
              style={{ border: '1px solid #DDDAD3', color: '#8A8681' }}
            >
              Проектов пока нет
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {projects.map((project, i) => {
                const stamp = getStatusStamp(project.status);
                return (
                  <Link key={project.id} to={`/projects/${project.id}`} className='block h-full'>
                    <div
                      className='group relative h-full rounded-md bg-white hover:shadow-sm transition-shadow p-5 flex flex-col gap-4'
                      style={{ border: '1px solid #DDDAD3' }}
                    >
                      <CornerMarks />
                      <div className='flex justify-between items-start gap-3'>
                        <div className="flex-1 min-w-0">
                          <Eyebrow>Проект №{String(i + 1).padStart(2, '0')}</Eyebrow>
                          <h3 className="font-medium mt-1 truncate" style={{ color: '#1C1B19' }}>{project.name}</h3>
                          <p className="text-sm mt-0.5 line-clamp-2" style={{ color: '#8A8681' }}>{project.description}</p>
                        </div>
                        <StampBadge label={stamp.label} tone={stamp.tone} />
                      </div>
                      <StageStepper
                        stages={project?.stages ?? []}
                        currentStage={
                          project?.stages?.find(s => s.status === "in_progress")?.id ?? project?.stages?.[0]?.id ?? ''
                        }
                        compact
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}