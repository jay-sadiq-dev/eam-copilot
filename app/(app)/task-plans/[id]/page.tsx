import { notFound } from 'next/navigation';
import { getDocument } from '@/backend/documents';
import { listLinks } from '@/backend/tppm';
import type { TaskPlan } from '@/data/types';
import { TaskPlanView } from '@/frontend/Results';
import { currentUser } from '../../../api/_lib/http';

export default async function TaskPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, doc, links] = await Promise.all([currentUser(), getDocument('tp', id), listLinks()]);
  if (!doc.ok || !user) notFound();
  const mine = links.ok ? links.data.filter((l) => l.taskPlanId === id) : [];
  const link = mine.find((l) => l.status === 'active') ?? mine[0];
  return (
    <div className="page">
      <div className="wrap">
        <TaskPlanView plan={doc.data as TaskPlan} link={link} role={user.role} />
      </div>
    </div>
  );
}
