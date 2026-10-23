// TPPM associations. The four checks are run in the backend; this file only stores their result.

import { sql, type Row } from './db';
import type { Tppm, TppmResult } from './types';

function toTppm(r: Row): Tppm {
  return {
    id: r.id,
    taskPlanId: r.task_plan_id,
    pmScheduleId: r.pm_schedule_id,
    status: r.status,
    score: r.score,
    checks: r.checks,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Newest first.
export async function listTppm(): Promise<Tppm[]> {
  const rows = await sql`
    SELECT l.*, u.name AS created_by_name
      FROM tppm l JOIN users u ON u.id = l.created_by
     ORDER BY l.updated_at DESC, l.id DESC`;
  return rows.map(toTppm);
}

export async function getTppm(id: string): Promise<Tppm | null> {
  const rows = await sql`
    SELECT l.*, u.name AS created_by_name
      FROM tppm l JOIN users u ON u.id = l.created_by
     WHERE l.id = ${id}`;
  return rows[0] ? toTppm(rows[0]) : null;
}

export async function getTppmByPair(taskPlanId: string, pmScheduleId: string): Promise<Tppm | null> {
  const rows = await sql`
    SELECT l.*, u.name AS created_by_name
      FROM tppm l JOIN users u ON u.id = l.created_by
     WHERE l.task_plan_id = ${taskPlanId} AND l.pm_schedule_id = ${pmScheduleId}`;
  return rows[0] ? toTppm(rows[0]) : null;
}

// Saves a check result as 'proposed' or 'failed'. A pair has one row: a failed row is
// overwritten in place; a proposed or active row is left alone and null is returned.
export async function saveTppmCheck(
  taskPlanId: string,
  pmScheduleId: string,
  result: TppmResult,
  userId: string,
): Promise<Tppm | null> {
  const rows = await sql`
    INSERT INTO tppm (task_plan_id, pm_schedule_id, status, score, checks, created_by)
    VALUES (${taskPlanId}, ${pmScheduleId}, ${result.status}, ${result.score}, ${JSON.stringify(result.checks)}::jsonb, ${userId})
    ON CONFLICT (task_plan_id, pm_schedule_id) DO UPDATE
       SET status = EXCLUDED.status, score = EXCLUDED.score, checks = EXCLUDED.checks,
           created_by = EXCLUDED.created_by, updated_at = now()
     WHERE tppm.status = 'failed'
    RETURNING id`;
  return rows[0] ? getTppm(rows[0].id) : null;
}

// proposed -> active, recording who confirmed it.
export async function confirmTppm(id: string, userId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE tppm SET status = 'active', confirmed_by = ${userId}, confirmed_at = now(), updated_at = now()
     WHERE id = ${id} AND status = 'proposed'
     RETURNING id`;
  return rows.length > 0;
}

// proposed -> failed, when a re-check at confirm time no longer passes.
export async function failTppm(id: string, result: Omit<TppmResult, 'status'>): Promise<boolean> {
  const rows = await sql`
    UPDATE tppm SET status = 'failed', score = ${result.score}, checks = ${JSON.stringify(result.checks)}::jsonb, updated_at = now()
     WHERE id = ${id} AND status = 'proposed'
     RETURNING id`;
  return rows.length > 0;
}

// Deletes a proposal the consultant doesn't want. Active and failed rows are kept.
export async function discardTppm(id: string): Promise<boolean> {
  const rows = await sql`DELETE FROM tppm WHERE id = ${id} AND status = 'proposed' RETURNING id`;
  return rows.length > 0;
}
