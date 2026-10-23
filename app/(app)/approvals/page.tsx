import { redirect } from 'next/navigation';
import { listDocuments } from '@/backend/documents';
import { listLinks } from '@/backend/tppm';
import { ApprovalCard } from '@/frontend/Results';
import { Icon } from '@/frontend/icons';
import { currentUser } from '../../api/_lib/http';

// Admin home: what's waiting, with Copilot's review notes. Decisions are made in the chat.
export default async function ApprovalsPage() {
  const user = await currentUser();
  if (user?.role !== 'admin') redirect('/copilot');

  const [tps, pms, links] = await Promise.all([listDocuments('tp'), listDocuments('pm'), listLinks()]);
  const docs = [...(tps.ok ? tps.data : []), ...(pms.ok ? pms.data : [])];
  const pending = docs.filter((d) => d.status === 'submitted');
  const tppm = links.ok ? links.data : [];
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <div className="wrap">
        <div className="greet">
          <h1>{part}, {user.name.split(' ')[0]}</h1>
          <p>{pending.length ? `${pending.length} document${pending.length > 1 ? 's are' : ' is'} waiting for your decision.` : 'You are all caught up.'}</p>
        </div>
        <div className="stats">
          <div className="stat warn"><span className="n">{pending.length}</span><span className="l">Waiting</span></div>
          <div className="stat ok"><span className="n">{docs.filter((d) => d.status === 'approved').length}</span><span className="l">Approved</span></div>
          <div className="stat"><span className="n">{tppm.filter((l) => l.status === 'active').length}</span><span className="l">Linked pairs</span></div>
          <div className="stat bad"><span className="n">{tppm.filter((l) => l.status === 'failed').length}</span><span className="l">Failed links</span></div>
        </div>
        {pending.length ? (
          pending.map((d) => <ApprovalCard key={d.id} doc={d} />)
        ) : (
          <div className="all-clear">
            <span className="ic"><Icon name="check" size={22} /></span>
            <strong>Nothing to approve</strong>
            <span className="muted">New submissions from consultants will appear here.</span>
          </div>
        )}
      </div>
    </div>
  );
}
