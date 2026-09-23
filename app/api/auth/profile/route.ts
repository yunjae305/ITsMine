import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok, readJson } from "@/lib/http";

const Body = z.object({ nickname: z.string().trim().min(1).max(20) });

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("로그인이 필요해요.", 401);
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return fail("닉네임을 1~20자로 입력해 주세요.");
  const db = await getDb();
  await db.update(schema.users).set({ name: parsed.data.nickname }).where(eq(schema.users.id, user.id));
  // 내가 총대인 모임의 표시 이름도 함께 바꾼다.
  await db
    .update(schema.members)
    .set({ nickname: parsed.data.nickname })
    .where(and(eq(schema.members.userId, user.id), eq(schema.members.isOwner, true)));
  return ok({ ok: true });
}
