import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/tokens";

const Body = z.object({ email: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return fail("아이디 또는 비밀번호를 확인해 주세요.");
  const { email, password } = parsed.data;
  const db = await getDb();
  const identifier = email.toLowerCase();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.email, identifier), eq(schema.users.username, identifier)));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("아이디 또는 비밀번호를 확인해 주세요.", 401);
  }
  await createSession(user.id);
  return ok({ ok: true });
}
