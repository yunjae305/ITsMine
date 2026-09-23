"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dashboard as DashboardData, DashboardGroup, MoneyFlowEntry } from "@/lib/groups";
import { formatWon } from "@/lib/settlement";
import { NewGroupWizard } from "./NewGroupWizard";

type View = "active" | "all" | "past";

export function Dashboard({ userName, data, view }: { userName: string; data: DashboardData; view: View }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const active = data.groups.filter((g) => g.status === "ACTIVE");
  const past = data.groups.filter((g) => g.status === "COMPLETED");
  const shown = view === "all" ? data.groups : view === "past" ? past : active;
  const receiveTotal = data.receive.reduce((s, e) => s + e.amount, 0);
  const sendTotal = data.send.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            <em>{userName}</em>님의 정산
          </h1>
          <p>만들었거나 참여한 모임과 진행 중인 정산을 다시 열 수 있어요</p>
        </div>
        <div className="page-head-actions">
          <Link className="secondary-button" href="/archive">
            아카이브
          </Link>
          <button type="button" className="primary-button" onClick={() => setWizardOpen(true)}>
            + 새 정산 시작
          </button>
        </div>
      </header>

      <section className="flow-card" aria-label={`받을 금액 ${formatWon(receiveTotal)}, 보낼 금액 ${formatWon(sendTotal)}`}>
        <div className="flow-intro">
          <span className="pill">진행 중 정산 {active.length}개</span>
          <div>
            <h2>지금 내 돈 흐름</h2>
          </div>
          <p>주고받을 금액을 한눈에 확인해요</p>
        </div>
        <div className="flow-tiles">
          <FlowTile kind="receive" total={receiveTotal} entries={data.receive} />
          <FlowTile kind="send" total={sendTotal} entries={data.send} />
        </div>
      </section>

      <div className="list-head">
        <h2>정산 목록</h2>
        <nav className="list-tabs" aria-label="정산 목록 보기">
          <Link href="/?view=all" className={view === "all" ? "active" : ""}>
            전체<small>{data.groups.length}</small>
          </Link>
          <Link href="/" className={view === "active" ? "active" : ""}>
            진행 중<small>{active.length}</small>
          </Link>
          <Link href="/?view=past" className={view === "past" ? "active" : ""}>
            지난 정산<small>{past.length}</small>
          </Link>
        </nav>
      </div>

      <section className="panel">
        {shown.length ? (
          <div className="group-list">
            {shown.map((g) => (
              <GroupRow key={g.id} group={g} />
            ))}
          </div>
        ) : data.groups.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">＋</span>
            <h3>아직 저장된 정산이 없어요</h3>
            <p>새 정산을 시작하면 이 목록에 계속 남아요.</p>
            <button type="button" className="primary-button" onClick={() => setWizardOpen(true)}>
              첫 정산 시작하기
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">✓</span>
            <h3>{view === "past" ? "지난 정산이 없어요" : "진행 중인 정산이 없어요"}</h3>
            <p>다른 정산은 전체 목록에서 확인할 수 있어요.</p>
            <Link className="primary-button" href="/?view=all">
              전체 정산 보기
            </Link>
          </div>
        )}
      </section>

      <NewGroupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

function FlowTile({ kind, total, entries }: { kind: "receive" | "send"; total: number; entries: MoneyFlowEntry[] }) {
  const [open, setOpen] = useState(false);
  const receive = kind === "receive";
  return (
    <div className={`flow-tile ${kind}${open ? " open" : ""}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="flow-tile-head">
          <i aria-hidden="true">{receive ? "←" : "→"}</i>
          {receive ? "내가 받을 돈" : "내가 보낼 돈"}
          <span className="chev" aria-hidden="true">⌄</span>
        </span>
        <strong>{formatWon(total)}</strong>
      </button>
      {open ? (
        <div className="flow-detail">
          <header>
            <span>{receive ? "받을 돈 상세" : "보낼 돈 상세"}</span>
            <span>{entries.length}건</span>
          </header>
          {entries.length ? (
            entries.map((e, i) => (
              <Link key={`${e.groupId}-${i}`} href={`/groups/${e.groupId}`}>
                <span>
                  {e.groupName}
                  <small>
                    {e.counterpart}
                    {receive ? "에게 받을 돈" : "에게 보낼 돈"}
                  </small>
                </span>
                <b>
                  {receive ? "+" : "−"}
                  {formatWon(e.amount)}
                </b>
              </Link>
            ))
          ) : (
            <p>{receive ? "지금 받을 돈이 없어요" : "지금 보낼 돈이 없어요"}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function GroupRow({ group }: { group: DashboardGroup }) {
  const done = group.status === "COMPLETED";
  const label = done
    ? group.myBalance >= 0
      ? "최종 받을 금액"
      : "최종 보낼 금액"
    : group.myBalance > 0
      ? "내가 받을 돈"
      : group.myBalance < 0
        ? "내가 보낼 돈"
        : "주고받을 금액";
  const amountClass = group.myBalance > 0 ? "amount-receive" : group.myBalance < 0 ? "amount-send" : "amount-zero";
  return (
    <Link className="group-row" href={`/groups/${group.id}`}>
      <div className="group-row-main">
        <div className="meta-line">
          <span>{group.mode === "SOLO" ? "혼자 정리" : "함께 정리"}</span>
          <span className={`status-dot${done ? " done" : group.waiting ? " waiting" : ""}`}>
            {done ? "정산 완료" : group.waiting ? "참여 대기" : "정산 중"}
          </span>
          {group.isOwner ? <span className="badge owner">총대</span> : null}
        </div>
        <h3>{group.name}</h3>
        <p>
          {group.memberCount}명 · 영수증 {group.receiptCount}장
        </p>
      </div>
      <div className="group-row-amount">
        <small>{label}</small>
        <strong className={amountClass}>{formatWon(Math.abs(group.myBalance))}</strong>
      </div>
      <span className="row-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
