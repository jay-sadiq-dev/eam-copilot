import type { DocStatus, LinkStatus, Role } from '../data/types';

export { STATUS_LABEL, describeTaskNumbers, CONFIDENCE_THRESHOLD, needsReview } from '../backend/rules';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

export const STATUS_TONE: Record<DocStatus | LinkStatus, Tone> = {
  draft: 'neutral',
  submitted: 'warn',
  approved: 'ok',
  rejected: 'bad',
  proposed: 'info',
  active: 'ok',
  failed: 'bad',
};

export const ROLE_LABEL: Record<Role, string> = { consultant: 'Functional consultant', admin: 'Admin' };

const FREQ: Record<number, string> = { 7: 'Weekly', 30: 'Monthly', 90: 'Quarterly', 365: 'Annual' };
export const frequency = (days: number) => FREQ[days] ?? `Every ${days} days`;

export const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

export const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function when(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

// 2027-01-31 -> 31 Jan 2027 (parsed as a calendar date, no timezone shift)
export function dueDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const docHref = (id: string) =>
  id.startsWith('TPPM-') ? `/tppm#${id}` : id.startsWith('TP-') ? `/task-plans/${id}` : `/pm-schedules/${id}`;
