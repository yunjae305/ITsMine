import "server-only";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __itsmineDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    db = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
  } else {
    // DATABASE_URL 이 없으면 로컬 내장 Postgres(PGlite)를 사용한다.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { mkdirSync } = await import("node:fs");
    const dir = process.env.PGLITE_DIR ?? ".data/pglite";
    mkdirSync(dir, { recursive: true });
    db = drizzle(new PGlite(dir), { schema }) as unknown as Db;
  }
  for (const statement of schema.BOOTSTRAP_SQL.split(";")) {
    if (statement.trim()) await db.execute(sql.raw(statement));
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__itsmineDb) {
    globalForDb.__itsmineDb = connect().catch((error) => {
      globalForDb.__itsmineDb = undefined;
      throw error;
    });
  }
  return globalForDb.__itsmineDb;
}

export { schema };
