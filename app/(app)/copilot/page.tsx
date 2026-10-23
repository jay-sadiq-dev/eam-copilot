import { redirect } from 'next/navigation';
import { CopilotChat } from '@/frontend/Chat';
import { currentUser } from '../../api/_lib/http';

export default async function CopilotPage() {
  const user = await currentUser();
  if (!user) redirect('/');
  return <CopilotChat user={user} />;
}
