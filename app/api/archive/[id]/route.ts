import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

async function findOwned(id: string) {
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.archives)
    .where(and(eq(schema.archives.id, id), eq(schema.archives.userId, user.id)));
  return row ?? null;
}

export async function GET(_request: Request, { params }: Params) {
  const row = await findOwned((await params).id);
  if (!row) return fail("정산표를 찾을 수 없어요.", 404);
  return new Response(new Uint8Array(row.image), {
    headers: { "Content-Type": row.mimeType, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const row = await findOwned((await params).id);
  if (!row) return fail("정산표를 찾을 수 없어요.", 404);
  const db = await getDb();
  await db.delete(schema.archives).where(eq(schema.archives.id, row.id));
  return ok({ ok: true });
}
