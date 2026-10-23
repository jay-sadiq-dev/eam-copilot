// Linking a task plan with a PM schedule (TPPM). Copilot runs the four checks and proposes;
// only a consultant's confirmation makes a link active. Admins never approve links.

import { getPmSchedule } from '../data/pm-schedules';
import { getTaskPlan } from '../data/task-plans';
import * as links from '../data/tppm';
import type { PmSchedule, TaskPlan, Tppm, TppmCheck } from '../data/types';
import type { SessionUser } from './auth';
import { fail, ok, type Result } from './result';
import { STATUS_LABEL, describeTaskNumbers, requireRole } from './rules';

export interface Evaluation {
  ok: boolean; // true when no check failed (warnings still pass)
  score: number;
  checks: TppmCheck[];
  covered: number;
  total: number;
}

// The four checks, in order. Pure: no database access, so it's easy to test.
export function evaluate(tp: TaskPlan, pm: PmSchedule): Evaluation {
  const checks: TppmCheck[] = [];

  const notApproved = [tp, pm].filter((d) => d.status !== 'approved');
  checks.push({
    label: 'Both approved',
    result: notApproved.length ? 'fail' : 'pass',
    detail: notApproved.length
      ? `${notApproved.map((d) => `${d.id} is ${STATUS_LABEL[d.status].toLowerCase()}`).join(', ')}. An admin must approve both first.`
      : 'An admin approved both documents.',
  });

  const sameAsset = tp.assetCode === pm.assetCode;
  checks.push({
    label: 'Same asset',
    result: sameAsset ? 'pass' : 'fail',
    detail: sameAsset
      ? `Both cover ${tp.assetName}.`
      : `Task plan is for ${tp.assetName}, PM schedule is for ${pm.assetName}.`,
  });

  const taskNumbers = new Set(tp.tasks.map((t) => t.n));
  const referenced = [...new Set(pm.lines.flatMap((l) => l.taskNumbers))];
  const missing = referenced.filter((n) => !taskNumbers.has(n));
  checks.push({
    label: 'Tasks exist',
    result: missing.length ? 'fail' : 'pass',
    detail: missing.length
      ? `PM calls ${describeTaskNumbers(missing)}, which ${missing.length > 1 ? 'are' : 'is'} not in ${tp.id}.`
      : `Every PM line calls a real task in ${tp.id}.`,
  });

  const covered = tp.tasks.filter((t) => referenced.includes(t.n)).length;
  const total = tp.tasks.length;
  const ratio = total ? covered / total : 0;
  checks.push({
    label: 'All tasks scheduled',
    result: ratio === 1 ? 'pass' : ratio >= 0.5 ? 'warn' : 'fail',
    detail: `${covered} of ${total} tasks are on a PM line.${ratio < 1 ? ' The rest would never reach a work order.' : ''}`,
  });

  let score = Math.round(100 * (0.55 + 0.45 * ratio));
  if (!sameAsset) score = Math.min(score, 22);
  if (missing.length) score = Math.min(score, 35);

  return { ok: !checks.some((c) => c.result === 'fail'), score, checks, covered, total };
}

export async function listLinks(): Promise<Result<Tppm[]>> {
  return ok(await links.listTppm());
}

export async function getLink(id: string): Promise<Result<Tppm>> {
  const link = await links.getTppm(id);
  return link ? ok(link) : fail(404, `There is no association ${id}.`);
}

// Runs the checks on a pair. Pass -> saved as 'proposed'; fail -> saved as 'failed' with reasons.
// A pair that already failed is re-checked in place; a proposed or active pair is left alone.
export async function checkPair(
  user: SessionUser,
  taskPlanId: string,
  pmScheduleId: string,
): Promise<Result<{ link: Tppm; evaluation: Evaluation }>> {
  const denied = requireRole(user, 'consultant', 'link task plans and PM schedules');
  if (denied) return denied;
  const [tp, pm] = await Promise.all([getTaskPlan(taskPlanId), getPmSchedule(pmScheduleId)]);
  if (!tp) return fail(404, `There is no task plan ${taskPlanId}.`);
  if (!pm) return fail(404, `There is no PM schedule ${pmScheduleId}.`);

  const existing = await links.getTppmByPair(tp.id, pm.id);
  if (existing && existing.status !== 'failed') {
    return fail(409, `${tp.id} and ${pm.id} are already in ${existing.id}.`);
  }

  const evaluation = evaluate(tp, pm);
  const link = await links.saveTppmCheck(
    tp.id,
    pm.id,
    { status: evaluation.ok ? 'proposed' : 'failed', score: evaluation.score, checks: evaluation.checks },
    user.id,
  );
  if (!link) return fail(409, `${tp.id} and ${pm.id} were just linked by someone else. Refresh and try again.`);
  return ok({ link, evaluation });
}

// Runs the checks again on an existing (failed) association.
export async function recheckLink(user: SessionUser, id: string) {
  const link = await links.getTppm(id);
  if (!link) return fail(404, `There is no association ${id}.`);
  return checkPair(user, link.taskPlanId, link.pmScheduleId);
}

// The consultant confirms a proposal. The checks run again first, since either document
// may have changed since it was proposed; if they no longer pass, it's marked failed.
export async function confirmLink(user: SessionUser, id: string): Promise<Result<Tppm>> {
  const denied = requireRole(user, 'consultant', 'confirm associations');
  if (denied) return denied;
  const link = await links.getTppm(id);
  if (!link) return fail(404, `There is no association ${id}.`);
  if (link.status !== 'proposed') return fail(409, `${id} is not waiting for confirmation.`);

  const [tp, pm] = await Promise.all([getTaskPlan(link.taskPlanId), getPmSchedule(link.pmScheduleId)]);
  const evaluation = evaluate(tp!, pm!);
  if (!evaluation.ok) {
    await links.failTppm(id, { score: evaluation.score, checks: evaluation.checks });
    return fail(409, `${id} no longer passes its checks.`);
  }
  if (!(await links.confirmTppm(id, user.id))) return fail(409, `${id} changed while you were confirming it.`);
  return getLink(id);
}

export async function discardLink(user: SessionUser, id: string): Promise<Result<{ id: string }>> {
  const denied = requireRole(user, 'consultant', 'discard associations');
  if (denied) return denied;
  const link = await links.getTppm(id);
  if (!link) return fail(404, `There is no association ${id}.`);
  if (link.status !== 'proposed') return fail(409, `Only a proposed association can be discarded.`);
  if (!(await links.discardTppm(id))) return fail(409, `${id} changed while you were discarding it.`);
  return ok({ id });
}
