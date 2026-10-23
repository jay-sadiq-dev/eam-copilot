// Shapes returned by the data layer. Columns are snake_case in Postgres, camelCase here.

export type Role = 'consultant' | 'admin';
export type DocStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type LinkStatus = 'proposed' | 'active' | 'failed';
export type CheckResult = 'pass' | 'warn' | 'fail';
export type DocKind = 'tp' | 'pm';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

// Header shared by task plans and PM schedules.
export interface DocumentHeader {
  id: string;
  title: string;
  assetCode: string;
  assetName: string;
  sourceFilename: string;
  status: DocStatus;
  ownerId: string;
  ownerName: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  n: number;
  description: string;
  trade: string;
  minutes: number;
  sourcePage: number;
  confidence: number; // percent, 0-100
  confirmedBy: string | null;
  confirmedAt: Date | null;
}

export interface TaskPlan extends DocumentHeader {
  kind: 'tp';
  tasks: Task[];
}

export interface PmLine {
  code: string;
  activity: string;
  intervalDays: number;
  nextDue: string; // YYYY-MM-DD
  taskNumbers: number[];
}

export interface PmSchedule extends DocumentHeader {
  kind: 'pm';
  lines: PmLine[];
}

export interface TppmCheck {
  label: string;
  result: CheckResult;
  detail: string;
}

export interface Tppm {
  id: string;
  taskPlanId: string;
  pmScheduleId: string;
  status: LinkStatus;
  score: number;
  checks: TppmCheck[];
  createdBy: string;
  createdByName: string;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Inputs

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

interface NewDocument {
  title: string;
  assetCode: string;
  assetName: string;
  sourceFilename: string;
  ownerId: string;
}

export type NewTask = Omit<Task, 'confirmedBy' | 'confirmedAt'>;

export interface NewTaskPlan extends NewDocument {
  tasks: NewTask[];
}

export interface NewPmSchedule extends NewDocument {
  lines: PmLine[];
}

export interface TppmResult {
  status: LinkStatus;
  score: number;
  checks: TppmCheck[];
}
