// The actions Copilot can take. Each tool calls backend/ as the signed-in user, so the same role
// checks apply as for any API call. A user only gets the tools for their role.

import { tool } from 'ai';
import { z } from 'zod';
import type { SessionUser } from '../backend/auth';
import { approve, confirmTask, getDocument, listDocuments, reject, saveExtractedDrafts, submitForApproval, type Doc } from '../backend/documents';
import type { Result } from '../backend/result';
import { needsReview } from '../backend/rules';
import { checkPair, confirmLink, discardLink, listLinks, recheckLink } from '../backend/tppm';
import type { DocKind, Tppm } from '../data/types';

const kindOf = (id: string): DocKind | null => (id.startsWith('TP-') ? 'tp' : id.startsWith('PM-') ? 'pm' : null);

// What the model sees back: ok + data, or ok: false + a message it can relay.
function reply<T, R>(result: Result<T>, shape: (data: T) => R) {
  return result.ok ? { ok: true as const, ...shape(result.data) } : { ok: false as const, error: result.error };
}

const badId = (id: string) => ({ ok: false as const, error: `${id} is not a task plan or PM schedule id.` });

// A compact view of a document, enough for the model to answer questions about it.
function summary(d: Doc) {
  const base = { id: d.id, title: d.title, asset: `${d.assetCode} (${d.assetName})`, status: d.status, owner: d.ownerName, rejectionReason: d.rejectionReason };
  if (d.kind === 'tp') {
    return {
      ...base,
      tasks: d.tasks.map((t) => ({ n: t.n, description: t.description, trade: t.trade, minutes: t.minutes, page: t.sourcePage, confidence: t.confidence, confirmed: Boolean(t.confirmedAt), needsConfirming: needsReview(t) })),
    };
  }
  return { ...base, lines: d.lines };
}

const linkSummary = (l: Tppm) => ({ id: l.id, taskPlanId: l.taskPlanId, pmScheduleId: l.pmScheduleId, status: l.status, score: l.score, checks: l.checks });

const statusFilter = z.enum(['draft', 'submitted', 'approved', 'rejected']).optional().describe('Only documents with this status');
const docId = z.string().describe('Task plan or PM schedule id, e.g. TP-0001 or PM-0001');
const linkId = z.string().describe('Association id, e.g. TPPM-0001');

const taskPlanDraft = z.object({
  title: z.string(),
  assetCode: z.string().describe('Short asset tag, e.g. P-101'),
  assetName: z.string().describe('e.g. Centrifugal pump P-101'),
  sourceFilename: z.string().describe('File name of the manual'),
  tasks: z.array(
    z.object({
      n: z.number().describe('Task number, starting at 1'),
      description: z.string(),
      trade: z.string(),
      minutes: z.number().describe('Whole minutes'),
      sourcePage: z.number().describe('Manual page the task came from'),
      confidence: z.number().describe('0-100, how sure you are you read it correctly'),
    }),
  ),
});

const pmScheduleDraft = z.object({
  title: z.string(),
  assetCode: z.string(),
  assetName: z.string(),
  sourceFilename: z.string(),
  lines: z.array(
    z.object({
      code: z.string().describe('A, B, C...'),
      activity: z.string(),
      intervalDays: z.number().describe('7 weekly, 30 monthly, 90 quarterly, 365 annual'),
      nextDue: z.string().describe('YYYY-MM-DD'),
      taskNumbers: z.array(z.number()).describe('Task numbers from the task plan this line covers'),
    }),
  ),
});

function readTools() {
  return {
    list_task_plans: tool({
      description: 'List task plans, newest first.',
      inputSchema: z.object({ status: statusFilter }),
      execute: async ({ status }) => reply(await listDocuments('tp', status), (docs) => ({ taskPlans: docs.map(summary) })),
    }),
    list_pm_schedules: tool({
      description: 'List PM schedules, newest first.',
      inputSchema: z.object({ status: statusFilter }),
      execute: async ({ status }) => reply(await listDocuments('pm', status), (docs) => ({ pmSchedules: docs.map(summary) })),
    }),
    get_document: tool({
      description: 'Get one task plan or PM schedule with all its tasks or lines.',
      inputSchema: z.object({ id: docId }),
      execute: async ({ id }) => {
        const kind = kindOf(id);
        return kind ? reply(await getDocument(kind, id), (d) => ({ document: summary(d) })) : badId(id);
      },
    }),
    list_links: tool({
      description: 'List TPPM associations (task plan + PM schedule links) with their checks.',
      inputSchema: z.object({}),
      execute: async () => reply(await listLinks(), (links) => ({ links: links.map(linkSummary) })),
    }),
  };
}

function consultantTools(user: SessionUser) {
  return {
    save_drafts: tool({
      description: 'Save the agreed draft task plan and/or PM schedule as drafts. Only when the user asks to save.',
      inputSchema: z.object({ taskPlan: taskPlanDraft.optional(), pmSchedule: pmScheduleDraft.optional() }),
      execute: async (drafts) =>
        reply(await saveExtractedDrafts(user, drafts), (saved) => ({
          taskPlan: saved.taskPlan && summary(saved.taskPlan),
          pmSchedule: saved.pmSchedule && summary(saved.pmSchedule),
        })),
    }),
    confirm_task: tool({
      description: 'Record that the user checked a low-confidence task. Only when the user says they checked it.',
      inputSchema: z.object({ taskPlanId: z.string(), n: z.number().describe('Task number') }),
      execute: async ({ taskPlanId, n }) => reply(await confirmTask(user, taskPlanId, n), (d) => ({ document: summary(d) })),
    }),
    submit_for_approval: tool({
      description: 'Submit a draft or rejected task plan or PM schedule for admin approval. Only when the user asks.',
      inputSchema: z.object({ id: docId }),
      execute: async ({ id }) => {
        const kind = kindOf(id);
        return kind ? reply(await submitForApproval(user, kind, id), (d) => ({ document: summary(d) })) : badId(id);
      },
    }),
    check_link: tool({
      description: 'Run the four TPPM checks on a task plan and PM schedule. Pass -> proposed link; fail -> saved as failed with reasons.',
      inputSchema: z.object({ taskPlanId: z.string(), pmScheduleId: z.string() }),
      execute: async ({ taskPlanId, pmScheduleId }) =>
        reply(await checkPair(user, taskPlanId, pmScheduleId), ({ link }) => ({ link: linkSummary(link) })),
    }),
    recheck_link: tool({
      description: 'Run the checks again on a failed association.',
      inputSchema: z.object({ id: linkId }),
      execute: async ({ id }) => reply(await recheckLink(user, id), ({ link }) => ({ link: linkSummary(link) })),
    }),
    confirm_link: tool({
      description: 'Confirm a proposed association so it becomes active. Only when the user asks to confirm it.',
      inputSchema: z.object({ id: linkId }),
      execute: async ({ id }) => reply(await confirmLink(user, id), (l) => ({ link: linkSummary(l) })),
    }),
    discard_link: tool({
      description: 'Discard a proposed association. Only when the user asks.',
      inputSchema: z.object({ id: linkId }),
      execute: async ({ id }) => reply(await discardLink(user, id), (d) => d),
    }),
  };
}

function adminTools(user: SessionUser) {
  return {
    approve_document: tool({
      description: 'Approve a submitted task plan or PM schedule. Only when the admin asks to approve it.',
      inputSchema: z.object({ id: docId }),
      execute: async ({ id }) => {
        const kind = kindOf(id);
        return kind ? reply(await approve(user, kind, id), (d) => ({ document: summary(d) })) : badId(id);
      },
    }),
    reject_document: tool({
      description: "Reject a submitted task plan or PM schedule with the admin's reason. Only when the admin asks.",
      inputSchema: z.object({ id: docId, reason: z.string().describe('Why, in the admin’s words; the consultant will see it') }),
      execute: async ({ id, reason }) => {
        const kind = kindOf(id);
        return kind ? reply(await reject(user, kind, id, reason), (d) => ({ document: summary(d) })) : badId(id);
      },
    }),
  };
}

export function toolsFor(user: SessionUser) {
  return user.role === 'admin'
    ? { ...readTools(), ...adminTools(user) }
    : { ...readTools(), ...consultantTools(user) };
}
