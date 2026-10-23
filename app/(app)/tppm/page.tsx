import { listDocuments } from '@/backend/documents';
import { listLinks } from '@/backend/tppm';
import { AskCopilot, TppmCard } from '@/frontend/Results';
import { currentUser } from '../../api/_lib/http';

export default async function TppmPage() {
  const [user, links, tps, pms] = await Promise.all([currentUser(), listLinks(), listDocuments('tp'), listDocuments('pm')]);
  const titles: Record<string, string> = {};
  for (const d of [...(tps.ok ? tps.data : []), ...(pms.ok ? pms.data : [])]) titles[d.id] = d.title;
  const all = links.ok ? links.data : [];
  return (
    <div className="page">
      <div className="wrap">
        <div className="head">
          <h1>TPPM</h1>
          <p>Associations between a task plan and a PM schedule. A link is made only when all checks pass and a consultant confirms it.</p>
        </div>
        {user?.role === 'consultant' && <AskCopilot>Ask Copilot: “Link TP-0001 with PM-0001”.</AskCopilot>}
        {all.length ? all.map((l) => <TppmCard key={l.id} link={l} titles={titles} />) : <div className="empty">No associations yet.</div>}
      </div>
    </div>
  );
}
