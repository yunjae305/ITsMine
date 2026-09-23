import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { GroupBoard } from "@/components/group/GroupBoard";
import { WaitingRoom } from "@/components/group/WaitingRoom";
import { getViewer, loadArchives, loadGroupBoard } from "@/lib/groups";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const viewer = isUuid ? await getViewer(id) : { user: null, member: null };
  const board = isUuid ? await loadGroupBoard(id, viewer) : null;
  const me = board?.members.find((m) => m.id === board.viewerMemberId);

  return (
    <main className="app-shell">
      <AppHeader user={viewer.user} chip={me?.nickname} />
      {!board ? (
        <section className="panel center-card">
          <span className="eyebrow">Settlement</span>
          <h1>모임을 열 수 없어요</h1>
          <p>삭제된 모임이거나 이 기기에서 참여하지 않은 모임이에요. 총대에게 접속 링크를 다시 받아 주세요.</p>
          <Link className="back-link" href="/">
            ← 홈으로
          </Link>
        </section>
      ) : board.waiting ? (
        <WaitingRoom board={board} />
      ) : (
        <GroupBoard
          board={board}
          canArchive={!!viewer.user && viewer.member?.userId === viewer.user.id}
          archives={viewer.user ? await loadArchives(viewer.user.id, board.id) : []}
        />
      )}
    </main>
  );
}
