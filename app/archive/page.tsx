import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ArchiveGrid } from "@/components/ArchiveGrid";
import { getCurrentUser } from "@/lib/auth";
import { loadArchives } from "@/lib/groups";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const archives = await loadArchives(user.id);
  return (
    <main className="app-shell">
      <AppHeader user={user} />
      <div className="page wide">
        <header className="page-head">
          <div>
            <span className="eyebrow">My archive</span>
            <h1 style={{ marginTop: 10 }}>나의 정산 아카이브</h1>
            <p>직접 꾸민 정산표를 모아두고 언제든 다시 꺼내 보세요</p>
          </div>
          <Link className="secondary-button" href="/">
            ← 대시보드
          </Link>
        </header>
        {archives.length ? (
          <ArchiveGrid archives={archives} />
        ) : (
          <section className="panel empty-state">
            <span className="empty-icon" aria-hidden="true">
              🧾
            </span>
            <h3>아직 저장한 정산표가 없어요</h3>
            <p>완료된 정산의 꾸미기 화면에서 아카이브에 저장해 보세요</p>
            <Link className="primary-button" href="/?view=past">
              지난 정산 보기
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
