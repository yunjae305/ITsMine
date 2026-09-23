import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getViewer } from "@/lib/groups";
import { fail, ok } from "@/lib/http";

const MAX_BYTES = 8 * 1024 * 1024;

/** 꾸민 정산표 이미지를 아카이브에 저장한다. (multipart: groupId, image) */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("아카이브는 로그인한 총대만 쓸 수 있어요.", 401);
  const form = await request.formData().catch(() => null);
  const groupId = form?.get("groupId");
  const image = form?.get("image");
  if (typeof groupId !== "string" || !(image instanceof Blob)) return fail("정산표 이미지를 확인해 주세요.");
  if (!["image/png", "image/jpeg"].includes(image.type) || image.size > MAX_BYTES) {
    return fail("정산표 이미지를 확인해 주세요.");
  }
  const viewer = await getViewer(groupId);
  if (!viewer.member || viewer.member.userId !== user.id) return fail("이 모임에 참여한 사람만 저장할 수 있어요.", 403);
  const db = await getDb();
  const [group] = await db.select({ name: schema.groups.name }).from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!group) return fail("모임을 찾을 수 없어요.", 404);
  const [row] = await db
    .insert(schema.archives)
    .values({
      userId: user.id,
      groupId,
      title: group.name,
      image: Buffer.from(await image.arrayBuffer()),
      mimeType: image.type,
    })
    .returning({ id: schema.archives.id });
  return ok({ id: row.id });
}
