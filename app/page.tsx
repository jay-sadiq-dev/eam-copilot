import { redirect } from 'next/navigation';
import { AuthForm } from '@/frontend/AuthForm';
import { currentUser } from './api/_lib/http';

// Sign in / sign up. Signed-in users go straight to their home screen.
export default async function Home() {
  const user = await currentUser();
  if (user) redirect(user.role === 'admin' ? '/approvals' : '/copilot');
  return <AuthForm />;
}
