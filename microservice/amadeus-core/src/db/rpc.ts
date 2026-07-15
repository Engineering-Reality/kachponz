import { query } from './pool.js';
import type pg from 'pg';

/**
 * Calls a Postgres function (`db/functions/*.sql`) as a single parameterized
 * round trip. `fnName` must always be a hardcoded string literal at the call
 * site — never built from user input.
 */
export async function callFn<T extends pg.QueryResultRow = pg.QueryResultRow>(
  fnName: string,
  args: ReadonlyArray<unknown>,
): Promise<pg.QueryResult<T>> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return query<T>(`SELECT * FROM ${fnName}(${placeholders})`, args);
}
