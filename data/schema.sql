-- EAM Copilot schema for Neon Postgres.
-- Run once on an empty database. Roles and status transitions are enforced in server code;
-- the constraints here guard the invariants that must never break.
-- task_plans, pm_schedules and users are independent: owner/reviewer/confirmer columns hold a
-- user id for traceability but have no foreign key. Foreign keys are used only by the child rows
-- (tasks, pm_lines) and by tppm, which references both documents and the users who checked/confirmed it.

CREATE TYPE user_role   AS ENUM ('consultant', 'admin');
CREATE TYPE doc_status  AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE link_status AS ENUM ('proposed', 'active', 'failed');

-- Readable ids: TP-0041, PM-0017, TPPM-0009 (grows past 4 digits instead of truncating).
CREATE FUNCTION format_id(prefix text, n bigint) RETURNS text
  LANGUAGE sql IMMUTABLE
  RETURN prefix || '-' || lpad(n::text, greatest(4, length(n::text)), '0');

CREATE SEQUENCE task_plan_seq;
CREATE SEQUENCE pm_schedule_seq;
CREATE SEQUENCE tppm_seq;

CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL CHECK (length(trim(name)) > 0),
  email         text        NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text        NOT NULL,
  role          user_role   NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_plans (
  id               text        PRIMARY KEY DEFAULT format_id('TP', nextval('task_plan_seq')),
  title            text        NOT NULL,
  asset_code       text        NOT NULL,
  asset_name       text        NOT NULL,
  source_filename  text        NOT NULL,
  status           doc_status  NOT NULL DEFAULT 'draft',
  owner_id         uuid        NOT NULL,
  rejection_reason text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  submitted_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_plans_rejection_has_reason
    CHECK (status <> 'rejected' OR length(trim(rejection_reason)) > 0),
  CONSTRAINT task_plans_decision_has_reviewer
    CHECK (status NOT IN ('approved', 'rejected') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

-- A task needs human review while confidence < 75 and confirmed_at is null.
CREATE TABLE tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_plan_id text        NOT NULL REFERENCES task_plans(id) ON DELETE CASCADE,
  n            integer     NOT NULL CHECK (n > 0),
  description  text        NOT NULL,
  trade        text        NOT NULL,
  minutes      integer     NOT NULL CHECK (minutes > 0),
  source_page  integer     NOT NULL CHECK (source_page > 0),
  confidence   smallint    NOT NULL CHECK (confidence BETWEEN 0 AND 100), -- percent
  confirmed_by uuid,
  confirmed_at timestamptz,
  UNIQUE (task_plan_id, n),
  CONSTRAINT tasks_confirmation_complete
    CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL))
);

CREATE TABLE pm_schedules (
  id               text        PRIMARY KEY DEFAULT format_id('PM', nextval('pm_schedule_seq')),
  title            text        NOT NULL,
  asset_code       text        NOT NULL,
  asset_name       text        NOT NULL,
  source_filename  text        NOT NULL,
  status           doc_status  NOT NULL DEFAULT 'draft',
  owner_id         uuid        NOT NULL,
  rejection_reason text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  submitted_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_schedules_rejection_has_reason
    CHECK (status <> 'rejected' OR length(trim(rejection_reason)) > 0),
  CONSTRAINT pm_schedules_decision_has_reviewer
    CHECK (status NOT IN ('approved', 'rejected') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

-- task_numbers has no foreign key on purpose: a schedule is drafted independently of any
-- task plan, and the TPPM "tasks exist" check must be able to report missing numbers.
CREATE TABLE pm_lines (
  id             uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  pm_schedule_id text      NOT NULL REFERENCES pm_schedules(id) ON DELETE CASCADE,
  code           text      NOT NULL,
  activity       text      NOT NULL,
  interval_days  integer   NOT NULL CHECK (interval_days > 0),
  next_due       date      NOT NULL,
  task_numbers   integer[] NOT NULL CHECK (cardinality(task_numbers) > 0),
  UNIQUE (pm_schedule_id, code)
);

-- One row per pair: re-running the check updates it, discarding a proposal deletes it.
-- checks holds [{ "label": ..., "result": "pass" | "warn" | "fail", "detail": ... }].
CREATE TABLE tppm (
  id             text        PRIMARY KEY DEFAULT format_id('TPPM', nextval('tppm_seq')),
  task_plan_id   text        NOT NULL REFERENCES task_plans(id) ON DELETE CASCADE,
  pm_schedule_id text        NOT NULL REFERENCES pm_schedules(id) ON DELETE CASCADE,
  status         link_status NOT NULL,
  score          smallint    NOT NULL CHECK (score BETWEEN 0 AND 100),
  checks         jsonb       NOT NULL,
  created_by     uuid        NOT NULL REFERENCES users(id),
  confirmed_by   uuid        REFERENCES users(id),
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_plan_id, pm_schedule_id),
  CONSTRAINT tppm_active_is_confirmed
    CHECK (status <> 'active' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE INDEX task_plans_status_idx         ON task_plans (status);
CREATE INDEX pm_schedules_status_idx       ON pm_schedules (status);
CREATE INDEX tppm_pm_schedule_idx          ON tppm (pm_schedule_id);
