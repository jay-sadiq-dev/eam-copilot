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

// Saves what Copilot extracted from a manual as drafts owned by the consultant.
export async function saveExtractedDrafts(
  user: SessionUser,
  drafts: ExtractedDrafts,
): Promise<Result<{ taskPlan?: TaskPlan; pmSchedule?: PmSchedule }>> {
  const denied = requireRole(user, 'consultant', 'create task plans and PM schedules');
  if (denied) return denied;
  if (!drafts.taskPlan && !drafts.pmSchedule) return fail(400, 'Nothing was extracted to save.');
  return ok({
    taskPlan: drafts.taskPlan ? await plans.createTaskPlan({ ...drafts.taskPlan, ownerId: user.id }) : undefined,
    pmSchedule: drafts.pmSchedule ? await schedules.createPmSchedule({ ...drafts.pmSchedule, ownerId: user.id }) : undefined,
  });
}
