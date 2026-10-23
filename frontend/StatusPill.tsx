import type { DocStatus, LinkStatus } from '../data/types';
import { STATUS_LABEL, STATUS_TONE } from './format';

export function StatusPill({ status }: { status: DocStatus | LinkStatus }) {
  return <span className={`pill t-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
