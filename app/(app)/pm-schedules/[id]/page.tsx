import { notFound } from 'next/navigation';
import { getDocument } from '@/backend/documents';
import { listLinks } from '@/backend/tppm';
import type { PmSchedule } from '@/data/types';
import { PmScheduleView } from '@/frontend/Results';
import { currentUser } from '../../../api/_lib/http';

export default async function PmSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, doc, links] = await Promise.all([currentUser(), getDocument('pm', id), listLinks()]);
  if (!doc.ok || !user) notFound();
  const mine = links.ok ? links.data.filter((l) => l.pmScheduleId === id) : [];
  const link = mine.find((l) => l.status === 'active') ?? mine[0];
  return (
    <div className="page">
      <div className="wrap">
        <PmScheduleView schedule={doc.data as PmSchedule} link={link} role={user.role} />
      </div>
    </div>
  );
}
