// Status changes shared by task plans and PM schedules.
// Each update only applies if the document is in the expected status, so two people acting at
// once can't both succeed. Whether the caller is allowed to do it is decided in the backend.

import { query, type Row } from './db';
import type { DocKind, DocumentHeader } from './types';

const TABLE: Record<DocKind, string> = { tp: 'task_plans', pm: 'pm_schedules' };

export function toHeader(r: Row): DocumentHeader {
  return {
    id: r.id,
    title: r.title,
    assetCode: r.asset_code,
    assetName: r.asset_name,
    sourceFilename: r.source_filename,
    status: r.status,
    ownerId: r.owner_id,
    ownerName: r.owner_name ?? null,
    rejectionReason: r.rejection_reason,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// draft | rejected -> submitted. Clears the previous review.
export async function submitDocument(kind: DocKind, id: string): Promise<boolean> {
  const rows = await query(
    `UPDATE ${TABLE[kind]}
        SET status = 'submitted', rejection_reason = NULL, reviewed_by = NULL, reviewed_at = NULL,
            submitted_at = now(), updated_at = now()
      WHERE id = $1 AND status IN ('draft', 'rejected')
      RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

// submitted -> approved.
export async function approveDocument(kind: DocKind, id: string, reviewerId: string): Promise<boolean> {
  const rows = await query(
    `UPDATE ${TABLE[kind]}
        SET status = 'approved', reviewed_by = $2, reviewed_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'submitted'
      RETURNING id`,
    [id, reviewerId],
  );
  return rows.length > 0;
}

// submitted -> rejected, with the reason the consultant will see.
export async function rejectDocument(kind: DocKind, id: string, reviewerId: string, reason: string): Promise<boolean> {
  const rows = await query(
    `UPDATE ${TABLE[kind]}
        SET status = 'rejected', rejection_reason = $3, reviewed_by = $2, reviewed_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'submitted'
      RETURNING id`,
    [id, reviewerId, reason.trim()],
  );
  return rows.length > 0;
}
