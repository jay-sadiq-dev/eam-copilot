// Read-only result views. Actions happen in the Copilot chat; these screens show the output.

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PmSchedule, Role, TaskPlan, Tppm } from '../data/types';
import { CONFIDENCE_THRESHOLD, STATUS_LABEL, STATUS_TONE, describeTaskNumbers, dueDate, frequency, minutes, needsReview, when } from './format';
import { Icon } from './icons';
import { StatusPill } from './StatusPill';

type Doc = TaskPlan | PmSchedule;

// A nudge towards the chat, with an example of what to ask.
export function AskCopilot({ children }: { children: ReactNode }) {
  return (
    <p className="hint">
      <Icon name="chat" size={15} />
      <span>
        {children} <Link href="/copilot">Open Copilot</Link>
      </span>
    </p>
  );
}

export function DocumentList({ docs, kind }: { docs: Doc[]; kind: 'tp' | 'pm' }) {
  if (!docs.length) return <div className="empty">Nothing here yet. Attach a manual in Copilot to draft one.</div>;
  return (
    <div className="list">
      {docs.map((d) => (
        <Link key={d.id} className="item" href={`/${kind === 'tp' ? 'task-plans' : 'pm-schedules'}/${d.id}`}>
          <span className="mono muted">{d.id}</span>
          <span>
            <span className="t">{d.title}</span>
            <br />
            <span className="s">
              {d.kind === 'tp' ? `${d.tasks.length} tasks` : d.lines.map((l) => frequency(l.intervalDays)).join(' · ')} · {d.ownerName ?? 'Unknown'}
            </span>
          </span>
          <StatusPill status={d.status} />
          <span className="chev"><Icon name="chev" /></span>
        </Link>
      ))}
    </div>
  );
}

function LinkFact({ link }: { link: Tppm | undefined }) {
  if (!link) return <span>Not linked</span>;
  return (
    <Link className={`pill t-${STATUS_TONE[link.status]}`} href={`/tppm#${link.id}`}>
      {link.id} · {STATUS_LABEL[link.status]}
    </Link>
  );
}

function DocHeader({ doc, link, back, extra }: { doc: Doc; link: Tppm | undefined; back: string; extra?: ReactNode }) {
  return (
    <>
      <Link className="btn ghost sm back" href={back}>
        <Icon name="back" size={15} /> {doc.kind === 'tp' ? 'All task plans' : 'All PM schedules'}
      </Link>
      <div className="head">
        <div className="ids" style={{ marginBottom: 6 }}>
          <span className="mono strong">{doc.id}</span>
          <StatusPill status={doc.status} />
        </div>
        <h1>{doc.title}</h1>
      </div>
      <div className="facts">
        <span>Asset <b>{doc.assetName}</b></span>
        <span>Source <b className="mono">{doc.sourceFilename}</b></span>
        {extra}
        <span>Owner <b>{doc.ownerName ?? 'Unknown'}</b></span>
        <span>TPPM <LinkFact link={link} /></span>
      </div>
    </>
  );
}

function StatusBanner({ doc, role }: { doc: Doc; role: Role }) {
  if (doc.status === 'rejected') {
    return <div className="banner bad"><strong>Rejected by admin:</strong> {doc.rejectionReason}</div>;
  }
  if (doc.kind === 'tp' && doc.status === 'draft') {
    const unsure = doc.tasks.filter(needsReview).length;
    if (unsure) {
      return (
        <div className="banner warn">
          <strong>Copilot is unsure about {unsure} task{unsure > 1 ? 's' : ''}.</strong> Check {unsure > 1 ? 'them' : 'it'} against the manual page and confirm before submitting.
        </div>
      );
    }
  }
  if (doc.status === 'submitted' && role !== 'admin') return <div className="banner info">Waiting for an admin to approve.</div>;
  return null;
}

function NextStep({ doc, role }: { doc: Doc; role: Role }) {
  if (role === 'admin') {
    return doc.status === 'submitted' ? <AskCopilot>Ask Copilot: “Approve {doc.id}” or “Reject {doc.id}, &lt;reason&gt;”.</AskCopilot> : null;
  }
  if (doc.status !== 'draft' && doc.status !== 'rejected') return null;
  const unsure = doc.kind === 'tp' ? doc.tasks.find(needsReview) : undefined;
  return unsure
    ? <AskCopilot>Checked it? Ask Copilot: “Confirm task {unsure.n} on {doc.id}”.</AskCopilot>
    : <AskCopilot>Ask Copilot: “Submit {doc.id} for approval”.</AskCopilot>;
}

export function TaskPlanView({ plan, link, role }: { plan: TaskPlan; link: Tppm | undefined; role: Role }) {
  const total = plan.tasks.reduce((a, t) => a + t.minutes, 0);
  return (
    <>
      <DocHeader doc={plan} link={link} back="/task-plans" extra={<span>Planned <b>{minutes(total)}</b></span>} />
      <StatusBanner doc={plan} role={role} />
      <NextStep doc={plan} role={role} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>#</th><th>Task</th><th>Trade</th><th className="num">Time</th><th>Page</th><th>Confidence</th></tr>
          </thead>
          <tbody>
            {plan.tasks.map((t) => {
              const low = t.confidence < CONFIDENCE_THRESHOLD;
              return (
                <tr key={t.n}>
                  <td className="mono muted">{t.n}</td>
                  <td>{t.description}</td>
                  <td>{t.trade}</td>
                  <td className="num">{minutes(t.minutes)}</td>
                  <td className="mono muted">p.{t.sourcePage}</td>
                  <td>
                    <span className="conf">
                      <span className={`bar${low ? ' low' : ''}`}><i style={{ width: `${t.confidence}%` }} /></span>
                      <span className="mono">{t.confidence}%</span>
                      {needsReview(t) ? <span className="pill t-warn">Unchecked</span> : low ? <span className="pill t-ok">Checked</span> : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PmScheduleView({ schedule, link, role }: { schedule: PmSchedule; link: Tppm | undefined; role: Role }) {
  return (
    <>
      <DocHeader doc={schedule} link={link} back="/pm-schedules" />
      <StatusBanner doc={schedule} role={role} />
      <NextStep doc={schedule} role={role} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Line</th><th>Activity</th><th>Interval</th><th>Next due</th><th>Tasks</th></tr>
          </thead>
          <tbody>
            {schedule.lines.map((l) => (
              <tr key={l.code}>
                <td className="mono muted">{l.code}</td>
                <td>{l.activity}</td>
                <td>{frequency(l.intervalDays)}</td>
                <td className="mono">{dueDate(l.nextDue)}</td>
                <td>{describeTaskNumbers(l.taskNumbers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const CHECK_ICON = { pass: 'check', warn: 'warn', fail: 'x' } as const;

export function TppmCard({ link, titles }: { link: Tppm; titles: Record<string, string> }) {
  const fails = link.checks.filter((c) => c.result === 'fail').length;
  return (
    <article className="card" id={link.id}>
      <div className="card-head">
        <div className="ids">
          <span className="mono strong">{link.id}</span>
          <StatusPill status={link.status} />
          <span className={`pill t-${link.status === 'failed' ? 'bad' : 'info'}`}>Match {link.score}%</span>
        </div>
        <span className="by">{link.createdByName} · {when(link.updatedAt)}</span>
      </div>
      <div className="pair">
        <Link href={`/task-plans/${link.taskPlanId}`}>{link.taskPlanId}</Link>
        <span className="muted">{titles[link.taskPlanId]}</span>
        <Icon name="link" size={15} />
        <Link href={`/pm-schedules/${link.pmScheduleId}`}>{link.pmScheduleId}</Link>
        <span className="muted">{titles[link.pmScheduleId]}</span>
      </div>
      {link.status === 'failed' && (
        <div className="banner bad"><strong>Not linked.</strong> {fails} check{fails > 1 ? 's' : ''} failed.</div>
      )}
      <ul className="checks">
        {link.checks.map((c) => (
          <li key={c.label} className={`chk r-${c.result}`}>
            <span className="chk-i"><Icon name={CHECK_ICON[c.result]} size={13} /></span>
            <span className="chk-l">{c.label}</span>
            <span className="chk-d">{c.detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ApprovalCard({ doc }: { doc: Doc }) {
  const notes: { tone: 'ok' | 'warn'; text: string }[] = [];
  if (doc.kind === 'tp') {
    const total = doc.tasks.reduce((a, t) => a + t.minutes, 0);
    notes.push({ tone: 'ok', text: `${doc.tasks.length} tasks, ${minutes(total)} planned. Every task cites a manual page.` });
    doc.tasks
      .filter((t) => t.confidence < CONFIDENCE_THRESHOLD)
      .forEach((t) => notes.push({ tone: 'warn', text: `Task ${t.n} was ${t.confidence}% confident. ${doc.ownerName ?? 'The consultant'} checked it on page ${t.sourcePage}.` }));
  } else {
    notes.push({ tone: 'ok', text: `${doc.lines.map((l) => `${l.activity} (${frequency(l.intervalDays).toLowerCase()}, ${describeTaskNumbers(l.taskNumbers)})`).join('; ')}.` });
  }
  return (
    <article className="qcard">
      <div className="card-head">
        <div className="ids">
          <span className="pill t-neutral">{doc.kind === 'tp' ? 'Task plan' : 'PM schedule'}</span>
          <span className="mono strong">{doc.id}</span>
        </div>
        <span className="by">{doc.ownerName ?? 'Unknown'} · {when(doc.submittedAt ?? doc.updatedAt)}</span>
      </div>
      <h3>{doc.title}</h3>
      <ul className="notes">
        {notes.map((n, i) => (
          <li key={i}>
            <span className="i" style={{ color: `var(--${n.tone}-fg)` }}><Icon name={n.tone === 'ok' ? 'check' : 'warn'} size={15} /></span>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
      <div className="row">
        <Link className="btn ghost" href={`/${doc.kind === 'tp' ? 'task-plans' : 'pm-schedules'}/${doc.id}`}>View</Link>
        <AskCopilot>Ask Copilot to approve or reject it.</AskCopilot>
      </div>
    </article>
  );
}
