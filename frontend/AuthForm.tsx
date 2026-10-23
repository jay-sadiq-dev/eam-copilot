'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Role } from '../data/types';

type Mode = 'signin' | 'signup';

const DEMO = { consultant: 'sara@eam.demo', admin: 'omar@eam.demo' } as const;

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<Role>('consultant');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = mode === 'signup';

  async function send(path: string, body: object) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Try again.');
      router.replace(data.role === 'admin' ? '/approvals' : '/copilot');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fields = { email: String(f.get('email') ?? ''), password: String(f.get('password') ?? '') };
    if (up) send('/api/auth/signup', { ...fields, name: String(f.get('name') ?? ''), role });
    else send('/api/auth/signin', fields);
  }

  return (
    <div className="auth">
      <div className="auth-box">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <div className="mark">E</div>EAM Copilot
        </div>
        <div className="auth-card">
          <div>
            <h1>{up ? 'Create your account' : 'Welcome back'}</h1>
            <p className="sub">
              {up ? 'Turn maintenance manuals into approved, linked maintenance plans.' : 'Sign in to your maintenance planning workspace.'}
            </p>
          </div>
          <div className="tabs" role="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <button key={m} className="tab" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(''); }}>
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>
          <form className="form" onSubmit={onSubmit} noValidate>
            {up && (
              <div className="field">
                <label className="lbl" htmlFor="f-name">Full name</label>
                <input className="in" id="f-name" name="name" autoComplete="name" placeholder="Ayesha Raza" />
              </div>
            )}
            <div className="field">
              <label className="lbl" htmlFor="f-email">Work email</label>
              <input className="in" id="f-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="f-pass">Password</label>
              <input className="in" id="f-pass" name="password" type="password" autoComplete={up ? 'new-password' : 'current-password'} placeholder={up ? 'At least 6 characters' : ''} />
            </div>
            {up && (
              <div className="field">
                <span className="lbl">Your role</span>
                <div className="roles">
                  <button type="button" className="role-opt" aria-pressed={role === 'consultant'} onClick={() => setRole('consultant')}>
                    <b>Consultant</b>
                    <span>Extracts and submits plans</span>
                  </button>
                  <button type="button" className="role-opt" aria-pressed={role === 'admin'} onClick={() => setRole('admin')}>
                    <b>Admin</b>
                    <span>Approves or rejects</span>
                  </button>
                </div>
              </div>
            )}
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn primary block" type="submit" disabled={busy}>
              {up ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
        <div className="demo">
          <span>Or try a demo account</span>
          <div className="row">
            <button className="btn sm" disabled={busy} onClick={() => send('/api/auth/signin', { email: DEMO.consultant, password: 'demo123' })}>
              Consultant demo
            </button>
            <button className="btn sm" disabled={busy} onClick={() => send('/api/auth/signin', { email: DEMO.admin, password: 'demo123' })}>
              Admin demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
