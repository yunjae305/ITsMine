import { and, count, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser, setGuestToken } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fail, ok, readJson } from "@/lib/http";
import { randomToken, sha256 } from "@/lib/tokens";

const Body = z.object({ nickname: z.string().trim().max(20).optional() });

class JoinError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return fail("닉네임을 20자 이내로 입력해 주세요.");
  const user = await getCurrentUser();
  const db = await getDb();
  const accessToken = randomToken();

  try {
    const result = await db.transaction(async (tx) => {
      const [invite] = await tx.select().from(schema.invites).where(eq(schema.invites.token, token)).for("update");
      if (!invite || invite.usedAt) throw new JoinError("이미 사용했거나 만료된 초대 링크예요.", 410);
      const [group] = await tx.select().from(schema.groups).where(eq(schema.groups.id, invite.groupId));
      if (!group) throw new JoinError("삭제된 모임이에요.", 404);

      if (invite.memberId) {
        // 재접속 링크: 기존 참여자 자리에 이 기기를 연결한다.
        await tx
          .update(schema.members)
          .set({ accessTokenHash: sha256(accessToken) })
          .where(eq(schema.members.id, invite.memberId));
        await tx.update(schema.invites).set({ usedAt: new Date() }).where(eq(schema.invites.token, token));
        return { groupId: group.id };
      }

      const nickname = parsed.data.nickname?.trim();
      if (!nickname) throw new JoinError("모임에서 사용할 닉네임을 입력해 주세요.", 400);
      const [{ joined, lastPosition }] = await tx
        .select({ joined: count(), lastPosition: max(schema.members.position) })
        .from(schema.members)
        .where(eq(schema.members.groupId, group.id));
      if (joined >= group.expectedMemberCount) throw new JoinError("모임 인원이 모두 찼어요.", 409);
      const [taken] = await tx
        .select({ id: schema.members.id })
        .from(schema.members)
        .where(and(eq(schema.members.groupId, group.id), eq(schema.members.nickname, nickname)));
      if (taken) throw new JoinError("이미 모임에서 쓰고 있는 닉네임이에요.", 409);
      // 로그인한 사람이 초대 링크로 들어오면 대시보드에도 모임이 보이도록 계정을 연결한다.
      const [alreadyMember] = user
        ? await tx
            .select({ id: schema.members.id })
            .from(schema.members)
            .where(and(eq(schema.members.groupId, group.id), eq(schema.members.userId, user.id)))
        : [];
      if (alreadyMember) throw new JoinError("이미 이 모임에 참여했어요.", 409);

      await tx.insert(schema.members).values({
        groupId: group.id,
        userId: user?.id ?? null,
        nickname,
        accessTokenHash: sha256(accessToken),
        position: (lastPosition ?? 0) + 1,
      });
      await tx.update(schema.invites).set({ usedAt: new Date() }).where(eq(schema.invites.token, token));

      const nowJoined = joined + 1;
      const full = nowJoined >= group.expectedMemberCount;
      await tx.insert(schema.notifications).values({
        userId: group.ownerUserId,
        groupId: group.id,
        title: full ? `${nickname}님이 참여해서 모두 모였어요 🎉` : `${nickname}님이 참여했어요`,
        body: full
          ? `${group.name} · 이제 정산을 시작할 수 있어요`
          : `${group.name} · ${nowJoined}/${group.expectedMemberCount}명 참여`,
      });
      if (full) {
        await tx
          .delete(schema.invites)
          .where(and(eq(schema.invites.groupId, group.id), isNull(schema.invites.usedAt), isNull(schema.invites.memberId)));
      }
      return { groupId: group.id };
    });
    await setGuestToken(result.groupId, accessToken);
    return ok(result);
  } catch (error) {
    if (error instanceof JoinError) return fail(error.message, error.status);
    throw error;
  }
}
