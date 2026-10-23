import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

let client: NeonQueryFunction<false, false> | undefined;

// Created on first use so importing this module (e.g. during a build) doesn't need DATABASE_URL.
function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    client = neon(url);
  }
  return client;
}

// Tagged template: values are always sent as parameters, never spliced into the SQL.
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  return db()(strings, ...values) as Promise<Row[]>;
}

// Plain text + $1 params, for the few queries whose table name comes from a fixed map.
export function query(text: string, params: unknown[] = []): Promise<Row[]> {
  return db().query(text, params) as Promise<Row[]>;
}
