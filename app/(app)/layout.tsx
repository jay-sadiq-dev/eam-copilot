import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { listDocuments } from '@/backend/documents';
import { needsReview } from '@/backend/rules';
import { listLinks } from '@/backend/tppm';
import type { PmSchedule, TaskPlan, Tppm } from '@/data/types';
import { Sidebar, type NavCounts } from '@/frontend/Sidebar';
import { currentUser } from '../api/_lib/http';

// Everything behind sign-in: sidebar + main column.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/');

  const [tps, pms, links] = await Promise.all([listDocuments('tp'), listDocuments('pm'), listLinks()]);
  const plans = (tps.ok ? tps.data : []) as TaskPlan[];
  const schedules = (pms.ok ? pms.data : []) as PmSchedule[];
  const tppm: Tppm[] = links.ok ? links.data : [];
  const admin = user.role === 'admin';

  // Badges show what needs this user's attention, as in the prototype.
  const counts: NavCounts = {
    pending: [...plans, ...schedules].filter((d) => d.status === 'submitted').length,
    taskPlans: plans.length,
    pmSchedules: schedules.length,
    links: tppm.length,
    attnTaskPlans: admin
      ? plans.filter((d) => d.status === 'submitted').length
      : plans.filter((d) => d.status === 'rejected' || (d.status === 'draft' && d.tasks.some(needsReview))).length,
    attnPmSchedules: admin
      ? schedules.filter((d) => d.status === 'submitted').length
      : schedules.filter((d) => d.status === 'rejected').length,
    attnLinks: admin ? 0 : tppm.filter((l) => l.status === 'proposed').length,
  };

  return (
    <div className="shell">
      <Sidebar user={user} counts={counts} />
      <main className="main">{children}</main>
    </div>
  );
}
