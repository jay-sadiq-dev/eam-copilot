# EAM Copilot

A small maintenance-planning app. A consultant uploads an equipment manual (PDF). An AI assistant reads it and drafts two things:

- a **task plan**: what work to do, by which trade, how long it takes, and which manual page it came from
- a **PM schedule**: how often the work happens and when it is next due

An admin approves or rejects them. Then the assistant links an approved task plan to an approved PM schedule, after checking they fit together.

**The main rule: the AI drafts, checks and suggests. People approve and confirm.**

---

## How it works

**Consultant**

1. Attaches a manual in the Copilot chat.
2. Copilot reads it and shows a rough draft in the chat. Nothing is saved yet.
3. The consultant asks for changes ("task 3 should be 45 minutes") until they are happy.
4. The consultant says "save it". Only then does Copilot save the drafts.
5. Any task Copilot was less than 75% sure about must be confirmed by the consultant before it can be sent for approval.
6. The consultant asks Copilot to submit the drafts for approval.
7. After approval, the consultant asks Copilot to link the task plan and PM schedule (this link is called a **TPPM**). Copilot runs four checks:
   - both are approved
   - both are for the same asset
   - every task the schedule mentions exists in the task plan
   - every task is on the schedule (if up to half are missing you get a warning; if more than half are missing, it fails)

   If the checks pass, Copilot proposes the link and the consultant confirms it. If they fail, the link is saved as failed, with the reasons.

**Admin**

- Asks Copilot what is waiting, then tells it to approve or reject. Rejecting needs a reason, which the consultant sees.
- Admins never approve links. Only consultants confirm those.

**Other screens** (Task plans, PM schedules, TPPM, Approvals) are for **viewing** results. All actions happen in the chat.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Consultant | sara@eam.demo | demo123 |
| Admin | omar@eam.demo | demo123 |

---

## Set it up

### What you need

- Node.js 20 or newer
- A free [Neon](https://neon.tech) account (the database)
- A free Google AI Studio API key (the AI)

### 1. Install

```bash
git clone https://github.com/jay-sadiq-dev/eam-copilot.git
cd eam-copilot
npm install
```

### 2. Create the database on Neon

1. Create a new project on [console.neon.tech](https://console.neon.tech).
2. Open **SQL Editor**.
3. Paste the whole of [`data/schema.sql`](data/schema.sql) and click **Run**. This creates the tables.
4. Paste the whole of [`data/seed.sql`](data/seed.sql) and click **Run**. This adds the two demo accounts. It is safe to run more than once.
5. On the project dashboard, click **Connect**, keep **Connection pooling** on, click **Show password**, and copy the connection string.

### 3. Get a Gemini API key

Go to [aistudio.google.com](https://aistudio.google.com), click **Get API key**, then **Create API key**.

### 4. Add your settings

Create a file called `.env` in the project folder:

```bash
DATABASE_URL=postgresql://...your Neon connection string...
AUTH_SECRET=...a long random string...
GOOGLE_GENERATIVE_AI_API_KEY=...your Gemini key...
# Optional: use a different Gemini model
# GEMINI_MODEL=gemini-3.5-flash
```

To make a good `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`.env` is in `.gitignore`. Never commit it.

### 5. Run it

```bash
npm run dev
```

Open http://localhost:3000 and click **Consultant demo**.

Other commands: `npm run build`, `npm start`, `npm run typecheck`.

### Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repo. No build settings need changing.
3. Add the same three settings (`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY`) under **Settings → Environment Variables**.
4. Deploy. Every push to `main` deploys again.

---

## Project layout

```
app/          Next.js pages and API routes (kept thin)
  (app)/      Screens behind sign-in: copilot, task-plans, pm-schedules, tppm, approvals
  api/        REST endpoints, plus /api/chat for Copilot
frontend/     Screen pieces: sidebar, chat, tables, sign-in form
backend/      Business rules: who can do what, the 75% rule, the four link checks
llm/          The AI: model, instructions, and the tools it can call
data/         Database: schema, demo seed, and all SQL queries
```

A request always flows the same way:

```
Screen or chat  →  app/api (thin)  →  backend/ (rules)  →  data/ (SQL)  →  Neon
                         ↑
             llm/ tools call backend/ too
```

Each layer only talks to the one below it. `backend/` does not use anything from Next.js, so it could move to its own server later without changes.

---

## Why it is built this way

### One app, one deployment on Vercel

- The brief asks for Vercel, and the free plan is enough.
- The pages and the API live in one Next.js project. One push deploys both.
- Vercel builds the new version next to the old one, then switches over. **The site never goes down during a deploy**, and you can roll back in one click.
- Pages and API share one web address, so the sign-in cookie just works (no cross-site setup).
- The code is still split into clear folders, so changing a business rule only touches `backend/`.

We looked at running the backend on a separate server (for example Render). It would add a second deployment, cross-site cookie problems, and slow "cold starts" on free plans, for no real gain at this size.

### A relational database (Postgres), not a document database

The data is all connected:

- a task plan **has** many tasks
- a PM schedule **has** many lines
- a link **joins** one task plan to one PM schedule

A relational database is made for this. It also lets the **database itself** guard the important rules, so bad data cannot get in even if the code has a bug:

- a rejected document must have a reason
- an approved or rejected document must record which admin decided
- a link can only be active once someone confirmed it
- confidence must be between 0 and 100
- emails and task numbers are unique

A document database (like MongoDB or a key-value store) would push all of these checks into code, and the link checks would mean loading everything and comparing it by hand.

### Neon

Free, hosted Postgres that works well with Vercel. Vercel's servers don't keep files between requests, so the database has to live somewhere else. Neon is the simplest fit.

### No ORM, plain SQL

There are only six tables. Plain SQL keeps every query visible and easy to review. All SQL lives in `data/`, values are always sent as parameters (safe from SQL injection), and TypeScript types are written by hand next to the queries.

### The schema

```
task_plans 1 ──< tasks              pm_schedules 1 ──< pm_lines
     │                                   │
     └───────────< tppm >────────────────┘
                    │
                  users   (who ran the check, who confirmed it)
```

Six tables: `users`, `task_plans`, `tasks`, `pm_schedules`, `pm_lines`, `tppm`.

- **Tasks and lines have their own tables.** They are lists inside a document, and the database can check each one (unique task numbers, valid confidence, real dates).
- **Approval is not its own table.** It is just the status, reviewer and reason columns on each document.
- **Task plans, PM schedules and users don't depend on each other.** They store who created or approved them, but without a hard link to `users`. Only `tppm` has foreign keys: to the task plan, the PM schedule, and the users who checked and confirmed it.
- **PM lines list task numbers with no hard link to the tasks table, on purpose.** A schedule is drafted on its own. The "tasks exist" check needs to be able to find numbers that are missing, which a hard link would not allow.
- **Readable IDs** like `TP-0001`, `PM-0001` and `TPPM-0001`, so people and the AI can refer to records easily.

### Sign-in

Passwords are stored as bcrypt hashes, never as plain text. After sign-in the server sets a signed, httpOnly cookie holding the user's id and role. There is no sessions table to manage. **Every action checks the role on the server**, so what a screen shows or hides is never what keeps people out.

### The AI: Vercel AI SDK with tool calling

- Copilot gets a set of **tools**, like `save_drafts`, `submit_for_approval` and `approve_document`. Each tool calls the same `backend/` functions as the API, **as the signed-in user**.
- Each user only gets the tools for their role. An admin's Copilot doesn't even have `save_drafts`. And even if a model tried, the server would refuse.
- Copilot is told to only change data when the user clearly asks.
- We chose the Vercel AI SDK because it handles the "call a tool, send the result back, answer" loop and streams replies to the chat with little code. We did not need LangGraph: there is one assistant and a few tools, not a multi-agent workflow.

### Why Gemini 3.5 Flash

- Gemini reads PDFs directly, so there is no separate PDF-parsing step.
- In testing, the newest Flash models (3.8 and "flash-latest") were often overloaded and refused requests. Gemini 2.5 Flash is closed to new API keys.
- 3.5 Flash answered a full turn (read a manual and draft both documents) in about 5 seconds.
- "Thinking" is set to low to keep answers fast.
- You can switch models any time with `GEMINI_MODEL`, without changing code.

---

## Limits to know about

- **PDFs must be 3 MB or smaller.** Vercel limits a request to about 4.5 MB, and the PDF is sent again with each chat message (see the next point).
- **Chats are not saved.** The conversation stays while you move between pages, but a full page refresh or signing out clears it. An unsaved draft is lost too, so save it first.
- **Each reply has 55 seconds.** Vercel stops server work at 60 seconds. If Copilot takes longer, you get a message and a **Try again** button.
- **Gemini is sometimes busy.** You then see "Gemini is busy right now" and can try again. A reply cut off part-way can be retried the same way.
- **The PDF itself is not stored.** Only its file name is kept on the documents.
- **Confidence scores are the AI's own estimate**, not a measured number. That is why low ones must be checked by a person.
- **Scanned or blurry pages** depend on how well Gemini can read them. Copilot is told to give those tasks a low confidence.
- **Free plans have limits.** Gemini's free tier caps how many requests you can make, and Neon's free tier has a small database size. Both are fine for a demo.
