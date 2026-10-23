// Every backend function returns a Result instead of throwing for expected failures,
// so the API layer can turn it into a status code and a message the user can read.

export type ErrorStatus = 400 | 401 | 403 | 404 | 409;

export type Result<T> = { ok: true; data: T } | { ok: false; status: ErrorStatus; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const fail = (status: ErrorStatus, error: string): Result<never> => ({ ok: false, status, error });
