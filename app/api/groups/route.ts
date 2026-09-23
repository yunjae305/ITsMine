import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok, readJson } from "@/lib/http";
import { randomToken } from "@/lib/tokens";

const Body = z.object({
  mode: z.enum(["SOLO", "TOGETHER"]),
  name: z.string().trim().min(1).max(40),
  guestNames: z.array(z.string().trim().max(20)).max(29).default([]),
  expectedMemberCount: z.number().int().min(2).max(30),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("로그인이 필요해요.", 401);
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return fail("모임 정보를 확인해 주세요.");
  const { mode, name } = parsed.data;
  const guestNames = parsed.data.guestNames.filter(Boolean);
  if (mode === "SOLO" && guestNames.length < 1) return fail("참여자를 한 명 이상 입력해 주세요.");
  const expectedMemberCount = mode === "SOLO" ? guestNames.length + 1 : parsed.data.expectedMemberCount;

  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(schema.groups)
      .values({ name, mode, expectedMemberCount, ownerUserId: user.id })
      .returning({ id: schema.groups.id });
    await tx.insert(schema.members).values([
      { groupId: group.id, userId: user.id, nickname: user.name, isOwner: true, position: 0 },
      ...(mode === "SOLO"
        ? guestNames.map((nickname, i) => ({ groupId: group.id, nickname, position: i + 1 }))
        : []),
    ]);
    const inviteTokens: string[] = [];
    if (mode === "TOGETHER") {
      for (let i = 1; i < expectedMemberCount; i++) inviteTokens.push(randomToken());
      await tx.insert(schema.invites).values(inviteTokens.map((token) => ({ token, groupId: group.id })));
    }
    return { groupId: group.id, inviteTokens };
  });
  return ok(result);
}
