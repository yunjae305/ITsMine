import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok, readJson } from "@/lib/http";
import { hashPassword } from "@/lib/tokens";

const Body = z.object({
  name: z.string().trim().min(1).max(20),
  email: z.email().trim(),
  password: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return fail("회원가입 정보를 확인해 주세요.");
  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const db = await getDb();
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) return fail("이미 가입된 이메일이에요.", 409);
  const [user] = await db
    .insert(schema.users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: schema.users.id });
  await createSession(user.id);
  return ok({ ok: true });
}
