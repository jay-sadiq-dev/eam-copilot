'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { getToolName, isToolUIPart, type FileUIPart, type UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SessionUser } from '../backend/auth';
import type { DocStatus, LinkStatus } from '../data/types';
import { chatFor } from './chatStore';
import { STATUS_LABEL, STATUS_TONE, docHref } from './format';
import { Icon } from './icons';

// Vercel limits request bodies to ~4.5 MB, and the PDF is resent with each message.
const MAX_PDF_BYTES = 3 * 1024 * 1024;

const STARTERS = {
  consultant: [
    { say: 'What is the status of my documents?', note: 'Where every task plan, PM schedule and link stands' },
    { say: 'What needs my attention?', note: 'Unchecked tasks, rejections and links to confirm' },
    { say: 'Link my approved task plan and PM schedule', note: 'Run the four TPPM checks on an approved pair' },
  ],
  admin: [
    { say: 'What is waiting for me?', note: 'See the approval queue with review notes' },
    { say: 'Summarise each submission', note: 'Tasks, intervals and anything Copilot was unsure of' },
    { say: 'Approve everything pending', note: 'Approve all submitted documents' },
  ],
};

const CHIPS = {
  consultant: ['Save the draft', 'What needs my attention?', 'Submit my checked drafts for approval'],
  admin: ['What is waiting for me?', 'Approve everything pending'],
};

// What the tools return (see llm/tools.ts).
interface DocOut { id: string; title: string; status: DocStatus }
interface LinkOut { id: string; taskPlanId: string; pmScheduleId: string; status: LinkStatus; score: number }
interface ToolOut {
  ok: boolean;
  error?: string;
  document?: DocOut;
  taskPlan?: DocOut;
  pmSchedule?: DocOut;
  link?: LinkOut;
  taskPlans?: unknown[];
  pmSchedules?: unknown[];
  links?: unknown[];
  id?: string;
}

type ToolPart = Extract<UIMessage['parts'][number], { toolCallId: string }>;

function toolResult(part: ToolPart): { ok: boolean; text: string } {
  if (part.state === 'output-error') return { ok: false, text: part.errorText };
  if (part.state !== 'output-available') return { ok: true, text: 'running…' };
  const out = part.output as ToolOut;
  if (!out.ok) return { ok: false, text: out.error ?? 'failed' };
  if (out.taskPlans) return { ok: true, text: `${out.taskPlans.length} task plans` };
  if (out.pmSchedules) return { ok: true, text: `${out.pmSchedules.length} PM schedules` };
  if (out.links) return { ok: true, text: `${out.links.length} associations` };
  const saved = [out.taskPlan, out.pmSchedule].filter(Boolean) as DocOut[];
  if (saved.length) return { ok: true, text: `saved ${saved.map((d) => d.id).join(' and ')} as draft` };
  if (out.document) return { ok: true, text: `${out.document.id} → ${STATUS_LABEL[out.document.status].toLowerCase()}` };
  if (out.link) return { ok: true, text: `${out.link.id} → ${STATUS_LABEL[out.link.status].toLowerCase()} (${out.link.score}%)` };
  if (out.id) return { ok: true, text: `discarded ${out.id}` };
  return { ok: true, text: 'done' };
}

// Records a tool changed or returned on its own, shown as cards under the reply.
function refsOf(parts: ToolPart[]) {
  const docs = new Map<string, DocOut>();
  const links = new Map<string, LinkOut>();
  for (const p of parts) {
    if (p.state !== 'output-available') continue;
    const out = p.output as ToolOut;
    if (!out.ok) continue;
    for (const d of [out.document, out.taskPlan, out.pmSchedule]) if (d) docs.set(d.id, d);
    if (out.link) links.set(out.link.id, out.link);
  }
  return { docs: [...docs.values()], links: [...links.values()] };
}

function AssistantMessage({ message }: { message: UIMessage }) {
  const tools = message.parts.filter(isToolUIPart) as ToolPart[];
  const { docs, links } = refsOf(tools);
  return (
    <div className="msg-a">
      <div className="ai-av" aria-hidden="true">E</div>
      <div className="msg-body">
        {tools.length > 0 && (
          <details className="trace">
            <summary>Ran {tools.length} step{tools.length > 1 ? 's' : ''}</summary>
            <ol>
              {tools.map((p) => {
                const r = toolResult(p);
                return (
                  <li key={p.toolCallId} className={r.ok ? '' : 'bad'}>
                    <Icon name={r.ok ? 'check' : 'x'} size={13} />
                    <span className="tool">{getToolName(p)}</span>
                    <span className="res">{r.text}</span>
                  </li>
                );
              })}
            </ol>
          </details>
        )}
        {message.parts.map((p, i) =>
          p.type === 'text' && p.text.trim() ? (
            <div key={i} className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.text}</ReactMarkdown>
            </div>
          ) : null,
        )}
        {docs.map((d) => (
          <Link key={d.id} className="ref" href={docHref(d.id)}>
            <span className="mono strong">{d.id}</span>
            <span className={`pill t-${STATUS_TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
            <span className="rt">{d.title}</span>
          </Link>
        ))}
        {links.map((l) => (
          <Link key={l.id} className="ref" href={docHref(l.id)}>
            <span className="mono strong">{l.id}</span>
            <span className={`pill t-${STATUS_TONE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
            <span className={`pill t-${l.status === 'failed' ? 'bad' : 'info'}`}>Match {l.score}%</span>
            <span className="rt">{l.taskPlanId} with {l.pmScheduleId}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: UIMessage }) {
  return (
    <div className="msg-u">
      {message.parts.map((p, i) =>
        p.type === 'file' ? (
          <span key={i} className="doc"><Icon name="file" size={14} /><span className="mono">{p.filename ?? 'file'}</span></span>
        ) : p.type === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : null,
      )}
    </div>
  );
}

// Errors come either from the stream (already a readable message) or from a JSON error response.
function errorText(error: Error) {
  try {
    return JSON.parse(error.message).error ?? error.message;
  } catch {
    return error.message || 'Copilot ran into a problem. Please try again.';
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CopilotChat({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { messages, sendMessage, status, error, setMessages, clearError } = useChat({ chat: chatFor(user.id) });
  const [input, setInput] = useState('');
  const [pdf, setPdf] = useState<FileUIPart | null>(null);
  const [attachError, setAttachError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  const consultant = user.role === 'consultant';

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, status]);

  // After a turn, refresh server data so sidebar counts and result pages reflect what the tools changed.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) router.refresh();
    wasBusy.current = busy;
  }, [busy, router]);

  function send(text: string) {
    const t = text.trim() || (pdf ? 'Draft the task plan and PM schedule from this manual.' : '');
    if (!t || busy) return;
    if (error) clearError();
    sendMessage({ text: t, files: pdf ? [pdf] : undefined });
    setInput('');
    setPdf(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setAttachError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return setAttachError(`${file.name} is not a PDF.`);
    if (file.size > MAX_PDF_BYTES) return setAttachError(`${file.name} is larger than 3 MB. Try a smaller manual or just the maintenance section.`);
    setPdf({ type: 'file', mediaType: 'application/pdf', filename: file.name, url: await readAsDataUrl(file) });
  }

  const first = user.name.split(' ')[0];
  const last = messages[messages.length - 1];
  const waiting = busy && (last?.role === 'user' || !last?.parts.some((p) => p.type === 'text' && p.text.trim()));

  return (
    <div className="chat">
      <div className="chat-top">
        <span className="t">Copilot</span>
        {messages.length > 0 && (
          <button className="btn sm ghost" disabled={busy} onClick={() => { setMessages([]); setPdf(null); clearError(); }}>
            <Icon name="plus" size={15} /> New chat
          </button>
        )}
      </div>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="hero">
            <h1>{consultant ? `Hi ${first}, which manual are we planning from?` : `Hi ${first}, anything to approve?`}</h1>
            <p>
              {consultant
                ? 'Attach an OEM manual. I draft the task plan and PM schedule, you refine it with me and tell me when to save. An admin approves, then I link them.'
                : 'I summarise what consultants submit. You decide; I only approve or reject when you tell me to.'}
            </p>
            <div className="starters">
              {STARTERS[user.role].map((s) => (
                <button key={s.say} className="starter" onClick={() => send(s.say)}>
                  <b>{s.say}</b>
                  <span>{s.note}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="log-inner">
            {messages.map((m) => (m.role === 'user' ? <UserMessage key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} />))}
            {waiting && (
              <div className="msg-a">
                <div className="ai-av">E</div>
                <div className="msg-body muted">Working <span className="dots"><span>.</span><span>.</span><span>.</span></span></div>
              </div>
            )}
            {error && (
              <div className="msg-a">
                <div className="ai-av">E</div>
                <div className="msg-body msg-err" role="alert">{errorText(error)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="composer">
        <div className="composer-inner">
          {(pdf || attachError) && (
            <div className="row">
              {pdf && (
                <span className="doc">
                  <Icon name="file" size={14} />
                  <span className="mono">{pdf.filename}</span>
                  <button type="button" aria-label="Remove attachment" onClick={() => setPdf(null)}><Icon name="x" size={13} /></button>
                </span>
              )}
              {attachError && <p className="err" role="alert">{attachError}</p>}
            </div>
          )}
          {messages.length > 0 && (
            <div className="chips">
              {CHIPS[user.role].map((c) => (
                <button key={c} className="chip" disabled={busy} onClick={() => send(c)}>{c}</button>
              ))}
            </div>
          )}
          <form className="box" onSubmit={onSubmit}>
            {consultant && (
              <>
                <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Attach a PDF" title="Attach a PDF">
                  <Icon name="clip" size={18} />
                </button>
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" hidden onChange={onFile} />
              </>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              aria-label="Message Copilot"
              placeholder={consultant ? 'Attach a manual, or ask Copilot to save, submit or link…' : 'Ask about the approval queue…'}
            />
            <button className="icon-btn primary" type="submit" aria-label="Send" disabled={busy || (!input.trim() && !pdf)}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
