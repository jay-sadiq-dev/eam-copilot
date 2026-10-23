import { listDocuments } from '@/backend/documents';
import { DocumentList } from '@/frontend/Results';

export default async function TaskPlansPage() {
  const result = await listDocuments('tp');
  return (
    <div className="page">
      <div className="wrap">
        <div className="head">
          <h1>Task plans</h1>
          <p>What to do on each asset: the steps, the trade, the time, and the manual page each came from.</p>
        </div>
        <DocumentList docs={result.ok ? result.data : []} kind="tp" />
      </div>
    </div>
  );
}
