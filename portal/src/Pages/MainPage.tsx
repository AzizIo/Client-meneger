import API from '../API/api'
import Header from '../Components/Header'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StageStepper from '../Components/Stagesstepper'
import { motion } from "motion/react"
import {
  colors,
  fontDisplay,
  fontMono,
  Eyebrow,
  StampBadge,
  CornerMarks,
  type StampTone,
} from '../Components/ui/designSystem'
import { div } from 'motion/react-client'
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

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

const STATUS_STAMP: Record<string, { label: string; tone: StampTone }> = {
  active: { label: 'В работе', tone: 'blue' },
  completed: { label: 'Завершён', tone: 'ink' },
  on_hold: { label: 'На паузе', tone: 'red' },
};

function getStatusStamp(status: string) {
  return STATUS_STAMP[status] ?? { label: status, tone: 'ink' as const };
}

// Вынесено на верхний уровень модуля — иначе React пересоздаёт этот
// компонент как новый тип на каждый ре-рендер MainPage и теряет стейт.
// ⚠️ Эндпоинт /tasks/{id}/ai-summary пока не существует на бэкенде —
// компонент тихо ничего не покажет (catch → summary остаётся null),
// пока роут не появится в main.py.
function TaskAiSummary({ taskId }: { taskId: string }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [stageId, setStageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    API.get(`/tasks/${taskId}/ai-summary`)
      .then(res => {
        if (cancelled) return
        setSummary(res.data.summary)
        setProjectId(res.data.project_id)
        setStageId(res.data.stage_id)
      })
      .catch(() => { if (!cancelled) setSummary(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [taskId])

  if (loading) {
    return (
      <p className='text-xs mt-2 italic' style={{ color: colors.muted, fontFamily: fontMono }}>
        ✦ ассистент анализирует...
      </p>
    )
  }

  if (!summary) return null

  const content = (
    <p className='text-xs mt-2 leading-relaxed' style={{ color: colors.stampBlue, fontFamily: fontMono }}>
      ✦ {summary}
    </p>
  )

  if (projectId && stageId) {
    return (
      <Link
        to={`/projects/${projectId}?stage=${stageId}&task=${taskId}`}
        onClick={(e) => e.stopPropagation()}
        className="block hover:opacity-70 transition-opacity"
      >
        {content}
      </Link>
    )
  }

  return content
}

export default function MainPage() {
  const [me, setMe] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalTask[]>([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)
  const [notification, setNotifications] = useState([])


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
  useEffect(() => {
    API.get('/notifications/three')
      .then(res => setNotifications(res.data))
      .catch(err => console.log(err.response?.data))
  }, [])

  const stats = [
    { label: 'Всего проектов', value: projects.length },
    { label: 'Активные', value: projects.filter(p => p.status === 'active').length },
    { label: 'Завершённые', value: projects.filter(p => p.status === 'completed').length },
    { label: 'На паузе', value: projects.filter(p => p.status === 'on_hold').length },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.paper }}>
      <Header />
      <main className='container mx-auto px-6 py-10 space-y-12'>
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Eyebrow>Дашборд · {today}</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold" style={{ color: colors.ink, fontFamily: fontDisplay }}>
            Добро пожаловать, {me ? me.full_name : "..."}
          </h1>
        </motion.section>

        <section>
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className='group relative rounded-md bg-white p-5 flex flex-col justify-between'
                style={{ border: `1px solid ${colors.line}` }}
              >
                <CornerMarks />
                <Eyebrow>{String(i + 1).padStart(2, '0')} · {stat.label}</Eyebrow>
                <motion.p
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-3 text-3xl font-semibold"
                  style={{ color: colors.ink, fontFamily: fontDisplay }}
                >
                  {stat.value}
                </motion.p>
              </div>
            ))}
          </div>
        </section>

        {me?.role === 'client' && (
          <section>
            <div className='flex items-center gap-2 mb-4'>
              <h2 className='text-lg font-semibold' style={{ color: colors.ink, fontFamily: fontDisplay }}>
                Ожидают вашего согласования
              </h2>
              {pendingApprovals.length > 0 && (
                <StampBadge label={String(pendingApprovals.length)} tone="blue" />
              )}
            </div>

            {loadingApprovals ? (
              <p className='text-sm' style={{ color: colors.muted }}>Загрузка...</p>
            ) : pendingApprovals.length === 0 ? (
              <div className='rounded-md bg-white p-6 text-sm text-center' style={{ border: `1px solid ${colors.line}`, color: colors.muted }}>
                Нет задач, ожидающих согласования
              </div>
            ) : (
              <div className='space-y-2'>
                {pendingApprovals.map(task => (
                  <Link key={task.id} to={`/projects/${task.project_id}?stage=${task.stage_id}&task=${task.id}`} className='block'>
                    <div
                      className='group relative rounded-md bg-white hover:shadow-sm transition-shadow p-4 flex items-center justify-between gap-4'
                      style={{ border: `1px solid ${colors.line}`, transition: `box-shadow 200ms ${EASE}` }}
                    >
                      <CornerMarks />
                      <div className='flex-1 min-w-0'>
                        <h3 className='text-sm font-medium truncate' style={{ color: colors.ink }}>{task.title}</h3>
                        {task.description && (
                          <p className='text-sm mt-0.5 line-clamp-1' style={{ color: colors.muted }}>
                            {task.description}
                          </p>
                        )}
                        <p className='text-xs mt-1.5' style={{ color: colors.muted, fontFamily: fontMono }}>
                          {task.assignee ? `${task.assignee.full_name} · ` : ''}
                          {new Date(task.created_at).toLocaleDateString('ru-RU')}
                        </p>
                        <TaskAiSummary taskId={task.id} />
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
          <h2 className='text-lg font-semibold mb-4' style={{ color: colors.ink, fontFamily: fontDisplay }}>
            Ваши проекты
          </h2>

          {projects.length === 0 ? (
            <div className='rounded-md bg-white p-6 text-sm text-center' style={{ border: `1px solid ${colors.line}`, color: colors.muted }}>
              Проектов пока нет
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {projects.map((project, i) => {
                const stamp = getStatusStamp(project.status);
                return (
                  <Link key={project.id} to={`/projects/${project.id}`} className='block h-full'>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ y: -2 }}
                      className='group relative h-full rounded-md bg-white hover:shadow-sm p-5 flex flex-col gap-4'
                      style={{ border: `1px solid ${colors.line}`, transition: `box-shadow 200ms ${EASE}` }}
                    >
                      <CornerMarks />
                      <div className='flex justify-between items-start gap-3'>
                        <div className="flex-1 min-w-0">
                          <Eyebrow>Проект №{String(i + 1).padStart(2, '0')}</Eyebrow>
                          <h3 className="font-medium mt-1 truncate" style={{ color: colors.ink }}>{project.name}</h3>
                          <p className="text-sm mt-0.5 line-clamp-2" style={{ color: colors.muted }}>{project.description}</p>
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
                    </motion.div>
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