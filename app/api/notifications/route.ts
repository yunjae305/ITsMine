import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok } from "@/lib/http";

/** 알림을 모두 읽음으로 표시한다. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail("로그인이 필요해요.", 401);
  const db = await getDb();
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
  return ok({ ok: true });
}
