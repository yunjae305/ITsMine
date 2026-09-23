"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { GroupBoard } from "@/lib/groups";
import { InviteLinks } from "../InviteLinks";
import { Avatar } from "../ui";

export function WaitingRoom({ board }: { board: GroupBoard }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showLinks, setShowLinks] = useState(false);
  const joined = board.members.length;
  const empty = Math.max(board.expectedMemberCount - joined, 0);

  // 모두 참여하면 정산 화면으로 자동 전환되도록 주기적으로 새로고침한다.
  useEffect(() => {
    const timer = setInterval(() => startTransition(() => router.refresh()), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <section className="panel waiting-card">
      <span className="eyebrow">함께 정리</span>
      <h1>{board.name}</h1>
      <p>모두 참여하면 정산 화면으로 자동 전환돼요</p>
      <div className="join-progress">
        <header>
          <span>참여 현황</span>
          <span>
            {joined} / {board.expectedMemberCount}명
          </span>
        </header>
        <div className="progress-track" aria-hidden="true">
          <div style={{ width: `${(joined / board.expectedMemberCount) * 100}%` }} />
        </div>
      </div>
      <div className="slot-list">
        {board.members.map((m, i) => (
          <div className="slot" key={m.id}>
            <Avatar name={m.nickname} index={i} />
            {m.nickname}
            {m.id === board.viewerMemberId ? " (나)" : ""}
          </div>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div className="slot empty" key={`empty-${i}`}>
            참여 전 자리
          </div>
        ))}
      </div>
      <div className="stack">
        <button type="button" className="secondary-button" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
          ↻ 참여 현황 새로고침
        </button>
        {board.viewerIsOwner && board.openInviteTokens.length ? (
          showLinks ? (
            <div style={{ textAlign: "left" }}>
              <InviteLinks groupName={board.name} tokens={board.openInviteTokens} />
            </div>
          ) : (
            <button type="button" className="primary-button" onClick={() => setShowLinks(true)}>
              초대 링크 다시 보기
            </button>
          )
        ) : null}
      </div>
      <Link className="back-link" href="/">
        ← 뒤로가기
      </Link>
    </section>
  );
}
