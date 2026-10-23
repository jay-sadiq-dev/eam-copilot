# EAM Copilot — project memory

A small, polished maintenance-planning web app for a 2-hour take-home, deployed on Vercel (free tier).
It must look and feel like the prototype at `docs/eam-copilot-prototype.html` (the brief calls it `docs/prototype.html`; same file).

## How we work (rules for Claude)
- The user decides what to build next, how the code looks, and when to commit and push. **Never commit or push. Never run git commands unless asked.**
- Do one task at a time, then summarise what changed and stop.
- Never commit secrets (API keys, DB URLs, auth secrets live in env vars, never in the repo).
- If something is unclear, ask one short question.
- Stack decided so far: **TypeScript only, Next.js, Vercel.** Everything else (DB, auth, AI provider, styling, structure) is the user's call; don't introduce it unilaterally.

## Key rule
The AI drafts, checks and proposes; humans approve and confirm. **Roles are enforced on the server**, never only in the UI.

## Roles
- **Functional consultant**: attaches an OEM manual (PDF) in chat; Copilot drafts a task plan and a PM schedule; confirms low-confidence tasks; submits for approval; asks Copilot to link approved pairs and confirms proposed links.
- **Admin**: approves or rejects submitted documents. Rejecting requires a reason. Admin can view results but cannot submit, confirm tasks, or check/confirm links.

Demo accounts (password `demo123`): `sara@eam.demo` (Sara Khan, consultant), `omar@eam.demo` (Omar Malik, admin).

## Flow
1. Sign up / sign in (full name on sign up, email, password ≥ 6 chars, role).
2. Consultant uploads a PDF; Copilot extracts a task plan (TP) and a PM schedule (PM), saved as drafts.
3. Tasks below 75% confidence must be confirmed by the consultant before the TP can be submitted.
4. Admin approves or rejects (with reason). Rejected docs can be resubmitted.
5. Copilot links a TP with a PM (TPPM) after four checks. Pass → proposed link the consultant confirms. Fail → saved as a failed association with reasons.

## Domain model (from the prototype)
- **Task plan** `TP-0041`: title, asset code (`P-101`), asset name, source PDF, status, owner, rejection note, timestamp, tasks.
  - **Task**: number `n`, text, trade, minutes, source page, confidence (0–1), reviewed flag (true by default when conf ≥ 0.75).
- **PM schedule** `PM-0017`: same header fields, plus lines.
  - **Line**: code (`A`, `B`), activity, interval days (7 Weekly, 30 Monthly, 90 Quarterly, 365 Annual, else "Every N days"), next due date, task numbers it covers.
- **TPPM association** `TPPM-0009`: tp id, pm id, status, match score %, checks[], by, when.
- IDs are prefix + 4-digit zero-padded sequence.

### Statuses (label / tone)
Documents: `draft` Draft (neutral) · `submitted` Awaiting approval (warn) · `approved` Approved (ok) · `rejected` Rejected (bad).
Links: `proposed` Needs your confirmation (info) · `active` Linked (ok) · `failed` Failed (bad).

### Business rules
- Submit: only from `draft` or `rejected`; blocked if any task has conf < 0.75 and not reviewed. Submitting clears the rejection note.
- Approve / reject: only from `submitted`. Reject requires a non-empty reason, shown to the consultant as a banner.
- Confirm task: consultant only, on draft/rejected TPs.
- TPPM checks (in order):
  1. **Both approved**: fail lists which doc is in which status.
  2. **Same asset**: TP.asset === PM.asset.
  3. **Tasks exist**: every task number referenced by a PM line exists in the TP.
  4. **All tasks scheduled**: covered/total TP tasks on some PM line. Prototype: 100% pass, ≥ 50% warn, else fail. (Open question: scope says "all tasks scheduled" is a hard check.)
  - Link OK = no check failed. Score = round(100 × (0.55 + 0.45 × ratio)), capped at 22 if asset differs, 35 if tasks missing.
- Running the check on a pair that already has a non-failed link → "already associated" (no new record). A failed record for the pair is re-run in place.
- Confirming a proposed link re-evaluates first; if it no longer passes it flips to `failed`. A proposed link can be discarded. Failed links offer "Run the check again".

## Screens (match the prototype)
- **Auth**: centered card, brand mark, Sign in / Sign up tabs, role picker on sign up, demo account buttons, inline error.
- **Shell**: 248px sidebar (Approvals for admin with pending badge; Copilot; "Results": Task plans, PM schedules, TPPM with counts and attention badges); user footer with sign out. Collapses to a top bar under 860px.
- Consultant lands on Copilot; admin lands on Approvals.
- **Copilot chat**: hero with greeting and 3 starter cards when empty; user bubbles; assistant messages with a collapsible "Ran N steps" trace (tool name + result), text, reference cards (id, status pill, title / match %), action buttons on the last message; suggestion chips; composer with attach (consultant only) and send; attached-doc chips; "New chat". Chat history is per user.
- **Lists**: TP / PM rows with id, title, subtitle, status pill, chevron.
- **Detail**: back link, id + pill, title, facts row (asset, source, planned time, owner, TPPM link), banners (rejected reason / unsure tasks / waiting), actions, inline reject reason box, table (TP: #, task, trade, time, page, confidence bar + Confirm/Checked; PM: line, activity, interval, next due, tasks).
- **TPPM**: pair picker card (consultant) + association cards with check rows (pass/warn/fail icons, failed rows tinted).
- **Approvals (admin)**: time-of-day greeting, 4 stats (Waiting, Approved, Linked pairs, Failed links), queue cards with Copilot review notes, Approve / Reject / View, all-clear empty state.

## Design tokens
Copy from the prototype `:root` (light) and dark overrides: Geist + Geist Mono, accent `#0B7A69` (dark `#4CC3AE`), yellow tag mark `#F5C443`, ok/warn/bad/info/neutral pill pairs. Supports light and dark via `prefers-color-scheme`.

## Seed data (prototype)
TP-0039/PM-0013 (P-205, submitted), TP-0038/PM-0012 (C-210, approved, linked as TPPM-0007), TP-0036 (CB-12, approved), PM-0011 (GB-4, approved), TPPM-0006 failed (asset mismatch), TPPM-0008 failed (not approved). Sample extraction: P-101 pump, 6 tasks (task 6 at 62% from a scanned page 41), PM with quarterly line A (tasks 1–4) and annual line B (tasks 5–6).

## Decisions log
- TypeScript + Next.js + Vercel.
- Database: Neon Postgres (relational). Tables: users, task_plans, tasks, pm_schedules, pm_lines, tppm. Approval is status/reviewer columns on the documents, not a separate table. ERD in `docs/erd.txt`.
- users, task_plans and pm_schedules are independent: owner/reviewer/confirmer columns store a user id with no FK. FKs only on tasks → task_plans, pm_lines → pm_schedules, and tppm → task_plans, pm_schedules and users (created_by, confirmed_by).
- Admin approves only task plans and PM schedules, never TPPM.
- No ORM (no Drizzle). Raw SQL through Neon's driver, kept in a dedicated data folder (schema SQL + query functions with hand-written TypeScript types).
- Chat conversations are not stored in the DB (out of scope).
- No PDF storage: keep only the source filename on the document.
