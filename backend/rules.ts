import type { DocKind, DocStatus, LinkStatus, Role, Task } from '../data/types';
import { fail } from './result';
import type { SessionUser } from './auth';

// Tasks below this confidence (percent) must be confirmed by a person before submitting.
export const CONFIDENCE_THRESHOLD = 75;

export const needsReview = (t: Task) => t.confidence < CONFIDENCE_THRESHOLD && !t.confirmedAt;

// A consultant can change and submit a document only while it is a draft or was sent back.
export const isEditable = (s: DocStatus) => s === 'draft' || s === 'rejected';

export const STATUS_LABEL: Record<DocStatus | LinkStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  proposed: 'Needs your confirmation',
  active: 'Linked',
  failed: 'Failed',
};

export const DOC_NAME: Record<DocKind, string> = { tp: 'task plan', pm: 'PM schedule' };

// Returns a 403 result when the user doesn't have the role, otherwise null.
export function requireRole(user: SessionUser, role: Role, action: string) {
  if (user.role === role) return null;
  return fail(403, `Only ${role === 'admin' ? 'an admin' : 'a consultant'} can ${action}.`);
}

// [1, 2, 3, 4, 6] -> "tasks 1–4, 6"
export function describeTaskNumbers(ns: number[]): string {
  if (!ns.length) return 'none';
  const sorted = [...ns].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = start;
  for (const n of [...sorted.slice(1), NaN]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  }
  return `${sorted.length > 1 ? 'tasks' : 'task'} ${parts.join(', ')}`;
}
