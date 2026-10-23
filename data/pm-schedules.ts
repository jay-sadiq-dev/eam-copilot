import { sql, type Row } from './db';
import { toHeader } from './documents';
import type { DocStatus, NewPmSchedule, PmLine, PmSchedule } from './types';

function toLine(r: Row): PmLine {
  return {
    code: r.code,
    activity: r.activity,
    intervalDays: r.interval_days,
    nextDue: r.next_due,
    taskNumbers: r.task_numbers,
  };
}

async function withLines(schedules: Row[]): Promise<PmSchedule[]> {
  if (!schedules.length) return [];
  const ids = schedules.map((s) => s.id);
  // next_due as text keeps the calendar date exact (no timezone shift from Date parsing).
  const lines = await sql`
    SELECT pm_schedule_id, code, activity, interval_days, next_due::text AS next_due, task_numbers
      FROM pm_lines WHERE pm_schedule_id = ANY(${ids}::text[]) ORDER BY code`;
  return schedules.map((s) => ({
    ...toHeader(s),
    kind: 'pm',
    lines: lines.filter((l) => l.pm_schedule_id === s.id).map(toLine),
  }));
}

// Newest first. Pass a status to filter, e.g. 'submitted' for the approval queue.
export async function listPmSchedules(status?: DocStatus): Promise<PmSchedule[]> {
  const rows = await sql`
    SELECT pm.*, u.name AS owner_name
      FROM pm_schedules pm LEFT JOIN users u ON u.id = pm.owner_id
     WHERE ${status ?? null}::doc_status IS NULL OR pm.status = ${status ?? null}::doc_status
     ORDER BY pm.created_at DESC, pm.id DESC`;
  return withLines(rows);
}

export async function getPmSchedule(id: string): Promise<PmSchedule | null> {
  const rows = await sql`
    SELECT pm.*, u.name AS owner_name
      FROM pm_schedules pm LEFT JOIN users u ON u.id = pm.owner_id
     WHERE pm.id = ${id}`;
  return (await withLines(rows))[0] ?? null;
}

// Inserts the schedule and all its lines in one statement, so it's all or nothing. Starts as draft.
export async function createPmSchedule(input: NewPmSchedule): Promise<PmSchedule> {
  const lines = input.lines.map((l) => ({
    code: l.code,
    activity: l.activity,
    interval_days: l.intervalDays,
    next_due: l.nextDue,
    task_numbers: l.taskNumbers,
  }));
  const rows = await sql`
    WITH schedule AS (
      INSERT INTO pm_schedules (title, asset_code, asset_name, source_filename, owner_id)
      VALUES (${input.title}, ${input.assetCode}, ${input.assetName}, ${input.sourceFilename}, ${input.ownerId})
      RETURNING id
    ), inserted AS (
      INSERT INTO pm_lines (pm_schedule_id, code, activity, interval_days, next_due, task_numbers)
      SELECT schedule.id, l.code, l.activity, l.interval_days, l.next_due, l.task_numbers
        FROM schedule, jsonb_to_recordset(${JSON.stringify(lines)}::jsonb)
             AS l(code text, activity text, interval_days int, next_due date, task_numbers int[])
    )
    SELECT id FROM schedule`;
  return (await getPmSchedule(rows[0].id))!;
}
