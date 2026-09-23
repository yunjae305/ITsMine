import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "./db";
import { randomToken, sha256 } from "./tokens";

const SESSION_COOKIE = "itsmine_session";
const SESSION_DAYS = 30;
const GUEST_COOKIE_PREFIX = "itsmine_m_";

export type CurrentUser = { id: string; email: string; name: string };

const cookieOptions = (maxAgeDays: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeDays * 24 * 60 * 60,
});

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomToken();
  await db.insert(schema.sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())));
  return row ?? null;
}

/** 초대 링크로 들어온 참여자의 기기별 접속 토큰(모임마다 하나). */
export async function setGuestToken(groupId: string, token: string) {
  (await cookies()).set(GUEST_COOKIE_PREFIX + groupId, token, cookieOptions(365));
}

export async function getGuestTokenHash(groupId: string): Promise<string | null> {
  const token = (await cookies()).get(GUEST_COOKIE_PREFIX + groupId)?.value;
  return token ? sha256(token) : null;
}
