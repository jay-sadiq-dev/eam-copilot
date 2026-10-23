'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SessionUser } from '../backend/auth';
import { ROLE_LABEL, initials } from './format';
import { Icon, type IconName } from './icons';

export interface NavCounts {
  pending: number;
  taskPlans: number;
  pmSchedules: number;
  links: number;
  attnTaskPlans: number;
  attnPmSchedules: number;
  attnLinks: number;
}

function NavItem({ href, icon, label, count, attn }: { href: string; icon: IconName; label: string; count?: number; attn?: number }) {
  const path = usePathname();
  const current = path === href || path.startsWith(`${href}/`);
  return (
    <Link className="nav-btn" href={href} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} size={17} />
      <span>{label}</span>
      <span className="sp" />
      {attn ? <span className="badge">{attn}</span> : null}
      {count !== undefined && <span className="cnt">{count}</span>}
    </Link>
  );
}

export function Sidebar({ user, counts }: { user: SessionUser; counts: NavCounts }) {
  const router = useRouter();

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  return (
    <aside className="side">
      <div className="brand">
        <div className="mark">E</div>
        <span className="brand-name">EAM Copilot</span>
      </div>
      <nav className="nav" aria-label="Main">
        {user.role === 'admin' && <NavItem href="/approvals" icon="shield" label="Approvals" attn={counts.pending} />}
        <NavItem href="/copilot" icon="chat" label="Copilot" />
        <div className="nav-label">Results</div>
        <NavItem href="/task-plans" icon="list" label="Task plans" count={counts.taskPlans} attn={counts.attnTaskPlans} />
        <NavItem href="/pm-schedules" icon="cal" label="PM schedules" count={counts.pmSchedules} attn={counts.attnPmSchedules} />
        <NavItem href="/tppm" icon="link" label="TPPM" count={counts.links} attn={counts.attnLinks} />
      </nav>
      <div className="side-foot">
        <span className="avatar">{initials(user.name)}</span>
        <div className="who">
          <div className="who-name">{user.name}</div>
          <div className="who-role">{ROLE_LABEL[user.role]}</div>
        </div>
        <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
          <Icon name="out" size={17} />
        </button>
      </div>
    </aside>
  );
}
