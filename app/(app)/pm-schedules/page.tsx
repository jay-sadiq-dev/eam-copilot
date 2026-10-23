import { listDocuments } from '@/backend/documents';
import { DocumentList } from '@/frontend/Results';

export default async function PmSchedulesPage() {
  const result = await listDocuments('pm');
  return (
    <div className="page">
      <div className="wrap">
        <div className="head">
          <h1>PM schedules</h1>
          <p>When the work happens: each line has an interval, a next due date, and the tasks it puts on the work order.</p>
        </div>
        <DocumentList docs={result.ok ? result.data : []} kind="pm" />
      </div>
    </div>
  );
}
