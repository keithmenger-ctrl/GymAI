import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type LevelSummary = {
  id: string
  name: string
  sort_order: number
  capacity: number
  enrolled: number
  weeks: number
}

export type ProgramSummary = {
  id: string
  name: string
  description: string | null
  active: boolean
  sport: string | null
  levels: LevelSummary[]
}

const LEVELS_JSON = `
  coalesce((select json_agg(json_build_object(
      'id', l.id, 'name', l.name, 'sort_order', l.sort_order, 'capacity', l.capacity,
      'enrolled', (select count(*)::int from athletes a where a.current_level_id = l.id and a.status in ('active','trial')),
      'weeks', (select count(*)::int from curriculum_items c where c.level_id = l.id)) order by l.sort_order, l.name)
    from program_levels l where l.program_id = p.id), '[]'::json)`

export const listPrograms = (s: Session) =>
  withUser(s.userId, (q) =>
    q<ProgramSummary>(
      `select p.id, p.name, p.description, p.active, sp.name as sport, ${LEVELS_JSON} as levels
         from programs p left join sports sp on sp.id = p.sport_id
        order by p.active desc, p.name`,
    ),
  )

export const getProgram = (s: Session, id: string) =>
  withUser(s.userId, async (q) => {
    const r = await q<ProgramSummary & { sport_id: string | null }>(
      `select p.id, p.name, p.description, p.active, p.sport_id, sp.name as sport, ${LEVELS_JSON} as levels
         from programs p left join sports sp on sp.id = p.sport_id where p.id = $1`,
      [id],
    )
    return r[0] ?? null
  })

export type CurriculumItem = {
  id: string
  week_number: number
  title: string
  description: string | null
  objectives: string | null
  drills: string[]
  cues: string | null
  notes: string | null
  video_url: string | null
}

export type LevelDetail = {
  id: string
  name: string
  capacity: number
  program_id: string
  program_name: string
  enrolled: number
  items: CurriculumItem[]
}

export const getLevel = (s: Session, levelId: string) =>
  withUser(s.userId, async (q) => {
    const r = await q<LevelDetail>(
      `select l.id, l.name, l.capacity, l.program_id, p.name as program_name,
              (select count(*)::int from athletes a where a.current_level_id = l.id and a.status in ('active','trial')) as enrolled,
              coalesce((select json_agg(json_build_object(
                  'id', c.id, 'week_number', c.week_number, 'title', c.title, 'description', c.description,
                  'objectives', c.objectives, 'drills', c.drills, 'cues', c.cues, 'notes', c.notes, 'video_url', c.video_url)
                  order by c.week_number, c.title)
                from curriculum_items c where c.level_id = l.id), '[]'::json) as items
         from program_levels l join programs p on p.id = l.program_id where l.id = $1`,
      [levelId],
    )
    return r[0] ?? null
  })
