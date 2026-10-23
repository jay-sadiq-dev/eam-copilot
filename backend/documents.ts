// Task plans and PM schedules: reading, submitting, approving, rejecting and confirming tasks.

import * as docs from '../data/documents';
import * as plans from '../data/task-plans';
import * as schedules from '../data/pm-schedules';
import type { DocKind, DocStatus, NewPmSchedule, NewTaskPlan, PmSchedule, TaskPlan } from '../data/types';
import type { SessionUser } from './auth';
import { fail, ok, type Result } from './result';
import { DOC_NAME, STATUS_LABEL, isEditable, needsReview, requireRole } from './rules';

export type Doc = TaskPlan | PmSchedule;

const load = (kind: DocKind, id: string): Promise<Doc | null> =>
  kind === 'tp' ? plans.getTaskPlan(id) : schedules.getPmSchedule(id);

const notFound = (kind: DocKind, id: string) => fail(404, `There is no ${DOC_NAME[kind]} ${id}.`);

// The status changed between our read and our write (someone else acted first).
const changed = (id: string) => fail(409, `${id} changed while you were working on it. Refresh and try again.`);

export async function listDocuments(kind: DocKind, status?: DocStatus): Promise<Result<Doc[]>> {
  return ok(kind === 'tp' ? await plans.listTaskPlans(status) : await schedules.listPmSchedules(status));
}

export async function getDocument(kind: DocKind, id: string): Promise<Result<Doc>> {
  const doc = await load(kind, id);
  return doc ? ok(doc) : notFound(kind, id);
}

export async function submitForApproval(user: SessionUser, kind: DocKind, id: string): Promise<Result<Doc>> {
  const denied = requireRole(user, 'consultant', 'submit for approval');
  if (denied) return denied;
  const doc = await load(kind, id);
  if (!doc) return notFound(kind, id);
  if (!isEditable(doc.status)) return fail(409, `${id} is ${STATUS_LABEL[doc.status].toLowerCase()}.`);
  if (doc.kind === 'tp') {
    const task = doc.tasks.find(needsReview);
    if (task) {
      return fail(409, `${id} is on hold: task ${task.n} is only ${task.confidence}% confident. Confirm it first.`);
    }
  }
  if (!(await docs.submitDocument(kind, id))) return changed(id);
  return getDocument(kind, id);
}

export async function approve(user: SessionUser, kind: DocKind, id: string): Promise<Result<Doc>> {
  const denied = requireRole(user, 'admin', 'approve');
  if (denied) return denied;
  const doc = await load(kind, id);
  if (!doc) return notFound(kind, id);
  if (doc.status !== 'submitted') return fail(409, `${id} is not waiting for approval.`);
  if (!(await docs.approveDocument(kind, id, user.id))) return changed(id);
  return getDocument(kind, id);
}

export async function reject(user: SessionUser, kind: DocKind, id: string, reason: string): Promise<Result<Doc>> {
  const denied = requireRole(user, 'admin', 'reject');
  if (denied) return denied;
  if (!reason.trim()) return fail(400, 'Add a reason so the consultant knows what to fix.');
  const doc = await load(kind, id);
  if (!doc) return notFound(kind, id);
  if (doc.status !== 'submitted') return fail(409, `${id} is not waiting for approval.`);
  if (!(await docs.rejectDocument(kind, id, user.id, reason))) return changed(id);
  return getDocument(kind, id);
}

// A consultant confirms a low-confidence task after checking it against the manual.
export async function confirmTask(user: SessionUser, taskPlanId: string, n: number): Promise<Result<Doc>> {
  const denied = requireRole(user, 'consultant', 'confirm tasks');
  if (denied) return denied;
  const plan = await plans.getTaskPlan(taskPlanId);
  if (!plan) return notFound('tp', taskPlanId);
  if (!isEditable(plan.status)) return fail(409, `${taskPlanId} is ${STATUS_LABEL[plan.status].toLowerCase()}.`);
  const task = plan.tasks.find((t) => t.n === n);
  if (!task) return fail(404, `${taskPlanId} has no task ${n}.`);
  if (!needsReview(task)) return fail(409, `Task ${n} on ${taskPlanId} doesn't need confirming.`);
  if (!(await plans.confirmTask(taskPlanId, n, user.id))) return changed(taskPlanId);
  return getDocument('tp', taskPlanId);
}

export interface ExtractedDrafts {
  taskPlan?: Omit<NewTaskPlan, 'ownerId'>;
  pmSchedule?: Omit<NewPmSchedule, 'ownerId'>;
}

const positiveInt = (v: number) => Number.isInteger(v) && v > 0;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Drafts come from the AI, so check them before they reach the database.
// Returns the first problem found, or null.
function draftProblem(drafts: ExtractedDrafts): string | null {
  for (const doc of [drafts.taskPlan, drafts.pmSchedule]) {
    if (doc && (!doc.title.trim() || !doc.assetCode.trim() || !doc.assetName.trim())) {
      return 'Each document needs a title, an asset code and an asset name.';
    }
  }
  const tp = drafts.taskPlan;
  if (tp) {
    if (!tp.tasks.length) return 'The task plan has no tasks.';
    const seen = new Set<number>();
    for (const t of tp.tasks) {
      if (!positiveInt(t.n) || seen.has(t.n)) return `Task numbers must be unique whole numbers above 0 (problem at task ${t.n}).`;
      seen.add(t.n);
      if (!t.description.trim() || !t.trade.trim()) return `Task ${t.n} needs a description and a trade.`;
      if (!positiveInt(t.minutes)) return `Task ${t.n} needs a time in whole minutes above 0.`;
      if (!positiveInt(t.sourcePage)) return `Task ${t.n} needs the manual page it came from.`;
      if (!Number.isInteger(t.confidence) || t.confidence < 0 || t.confidence > 100) {
        return `Task ${t.n} needs a confidence between 0 and 100.`;
      }
    }
  }
  const pm = drafts.pmSchedule;
  if (pm) {
    if (!pm.lines.length) return 'The PM schedule has no lines.';
    const codes = new Set<string>();
    for (const l of pm.lines) {
      if (!l.code.trim() || codes.has(l.code)) return `PM line codes must be unique (problem at "${l.code}").`;
      codes.add(l.code);
      if (!l.activity.trim()) return `PM line ${l.code} needs an activity.`;
      if (!positiveInt(l.intervalDays)) return `PM line ${l.code} needs an interval in whole days above 0.`;
      if (!isDate(l.nextDue)) return `PM line ${l.code} needs a next due date as YYYY-MM-DD.`;
      if (!l.taskNumbers.length || !l.taskNumbers.every(positiveInt)) {
        return `PM line ${l.code} needs at least one task number.`;
      }
    }
  }
  return null;
}

// Saves what Copilot extracted from a manual as drafts owned by the consultant.
export async function saveExtractedDrafts(
  user: SessionUser,
  drafts: ExtractedDrafts,
): Promise<Result<{ taskPlan?: TaskPlan; pmSchedule?: PmSchedule }>> {
  const denied = requireRole(user, 'consultant', 'create task plans and PM schedules');
  if (denied) return denied;
  if (!drafts.taskPlan && !drafts.pmSchedule) return fail(400, 'Nothing was extracted to save.');
  const problem = draftProblem(drafts);
  if (problem) return fail(400, problem);
  return ok({
    taskPlan: drafts.taskPlan ? await plans.createTaskPlan({ ...drafts.taskPlan, ownerId: user.id }) : undefined,
    pmSchedule: drafts.pmSchedule ? await schedules.createPmSchedule({ ...drafts.pmSchedule, ownerId: user.id }) : undefined,
  });
}
