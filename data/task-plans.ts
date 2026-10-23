import { sql, type Row } from './db';
import { toHeader } from './documents';
import type { DocStatus, NewTaskPlan, Task, TaskPlan } from './types';

function toTask(r: Row): Task {
  return {
    n: r.n,
    description: r.description,
    trade: r.trade,
    minutes: r.minutes,
    sourcePage: r.source_page,
    confidence: r.confidence,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
  };
}

async function withTasks(plans: Row[]): Promise<TaskPlan[]> {
  if (!plans.length) return [];
  const ids = plans.map((p) => p.id);
  const tasks = await sql`SELECT * FROM tasks WHERE task_plan_id = ANY(${ids}::text[]) ORDER BY n`;
  return plans.map((p) => ({
    ...toHeader(p),
    kind: 'tp',
    tasks: tasks.filter((t) => t.task_plan_id === p.id).map(toTask),
  }));
}

// Newest first. Pass a status to filter, e.g. 'submitted' for the approval queue.
export async function listTaskPlans(status?: DocStatus): Promise<TaskPlan[]> {
  const rows = await sql`
    SELECT tp.*, u.name AS owner_name
      FROM task_plans tp LEFT JOIN users u ON u.id = tp.owner_id
     WHERE ${status ?? null}::doc_status IS NULL OR tp.status = ${status ?? null}::doc_status
     ORDER BY tp.created_at DESC, tp.id DESC`;
  return withTasks(rows);
}

export async function getTaskPlan(id: string): Promise<TaskPlan | null> {
  const rows = await sql`
    SELECT tp.*, u.name AS owner_name
      FROM task_plans tp LEFT JOIN users u ON u.id = tp.owner_id
     WHERE tp.id = ${id}`;
  return (await withTasks(rows))[0] ?? null;
}

// Inserts the plan and all its tasks in one statement, so it's all or nothing. Starts as draft.
export async function createTaskPlan(input: NewTaskPlan): Promise<TaskPlan> {
  const tasks = input.tasks.map((t) => ({
    n: t.n,
    description: t.description,
    trade: t.trade,
    minutes: t.minutes,
    source_page: t.sourcePage,
    confidence: t.confidence,
  }));
  const rows = await sql`
    WITH plan AS (
      INSERT INTO task_plans (title, asset_code, asset_name, source_filename, owner_id)
      VALUES (${input.title}, ${input.assetCode}, ${input.assetName}, ${input.sourceFilename}, ${input.ownerId})
      RETURNING id
    ), inserted AS (
      INSERT INTO tasks (task_plan_id, n, description, trade, minutes, source_page, confidence)
      SELECT plan.id, t.n, t.description, t.trade, t.minutes, t.source_page, t.confidence
        FROM plan, jsonb_to_recordset(${JSON.stringify(tasks)}::jsonb)
             AS t(n int, description text, trade text, minutes int, source_page int, confidence smallint)
    )
    SELECT id FROM plan`;
  return (await getTaskPlan(rows[0].id))!;
}

// Records that a person checked a task. Returns false if the task doesn't exist or was already confirmed.
export async function confirmTask(taskPlanId: string, n: number, userId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE tasks SET confirmed_by = ${userId}, confirmed_at = now()
     WHERE task_plan_id = ${taskPlanId} AND n = ${n} AND confirmed_at IS NULL
     RETURNING id`;
  if (rows.length) await sql`UPDATE task_plans SET updated_at = now() WHERE id = ${taskPlanId}`;
  return rows.length > 0;
}
