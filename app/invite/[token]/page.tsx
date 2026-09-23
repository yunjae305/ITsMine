import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { InviteJoin } from "@/components/InviteJoin";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const user = await getCurrentUser();
  const [invite] = await db.select().from(schema.invites).where(eq(schema.invites.token, token));
  const [group] = invite ? await db.select().from(schema.groups).where(eq(schema.groups.id, invite.groupId)) : [];
  const [{ joined }] = group
    ? await db.select({ joined: count() }).from(schema.members).where(eq(schema.members.groupId, group.id))
    : [{ joined: 0 }];
  const [reconnectMember] = invite?.memberId
    ? await db.select({ nickname: schema.members.nickname }).from(schema.members).where(eq(schema.members.id, invite.memberId))
    : [];
  const usable = !!invite && !invite.usedAt && !!group && (invite.memberId ? !!reconnectMember : joined < group.expectedMemberCount);

  return (
    <main className="app-shell">
      <AppHeader user={user} />
      <section className="panel center-card">
        {usable && group ? (
          <InviteJoin
            token={token}
            groupName={group.name}
            joined={joined}
            expected={group.expectedMemberCount}
            reconnectNickname={reconnectMember?.nickname ?? null}
            defaultNickname={user?.name ?? ""}
          />
        ) : (
          <>
            <span className="eyebrow">함께 정리 초대</span>
            <h1>사용할 수 없는 초대 링크예요</h1>
            <p>이미 누군가 사용했거나, 모임 인원이 모두 찼거나, 삭제된 모임이에요. 총대에게 새 링크를 받아 주세요.</p>
          </>
        )}
        <Link className="back-link" href="/">
          ← 홈으로
        </Link>
      </section>
    </main>
  );
}
