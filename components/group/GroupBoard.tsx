"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { ArchiveView, BoardReceipt, GroupBoard as Board } from "@/lib/groups";
import { formatDate } from "@/lib/format";
import { formatWon } from "@/lib/settlement";
import { shareInvite } from "../InviteLinks";
import { api, Avatar, Modal, useToast } from "../ui";
import { ReceiptModal } from "./ReceiptModal";
import { SettlementCardDialog } from "./SettlementCardDialog";

export function GroupBoard({ board, canArchive, archives }: { board: Board; canArchive: boolean; archives: ArchiveView[] }) {
  const router = useRouter();
  const toast = useToast();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [filterMemberId, setFilterMemberId] = useState(board.viewerMemberId);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<{ receipt: BoardReceipt | null } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const completed = board.status === "COMPLETED";
  const nickname = useMemo(() => new Map(board.members.map((m) => [m.id, m.nickname])), [board.members]);
  const filterName = nickname.get(filterMemberId) ?? "참여자";
  const filtered = board.receipts.filter((r) => r.createdByMemberId === filterMemberId);
  const selected = filtered.find((r) => r.id === selectedReceiptId) ?? filtered[0] ?? null;
  const filteredTotal = filtered.reduce((s, r) => s + r.total, 0);
  const canEditReceipt = (r: BoardReceipt) => !completed && (r.createdByMemberId === board.viewerMemberId || board.viewerIsOwner);

  async function act(body: object, success?: string) {
    setBusy(true);
    try {
      const result = await api<Record<string, unknown>>(`/api/groups/${board.id}`, { body });
      if (success) toast.show(success);
      router.refresh();
      return result;
    } catch (e) {
      toast.show((e as Error).message, "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function completeSettlement() {
    if (!window.confirm("정산을 완료하면 영수증과 참여 내역을 더 이상 수정할 수 없어요. 완료할까요?")) return;
    const result = await act({ action: "completeSettlement" }, "정산을 완료했어요.");
    if (result) setCardOpen(true);
  }

  async function reissue(memberId: string, name: string) {
    const result = await act({ action: "createReconnectInvite", memberId });
    if (!result) return;
    const url = `${window.location.origin}/invite/${result.token as string}`;
    const message = await shareInvite(board.name, url);
    toast.show(message || `${name}님의 접속 링크를 새로 만들었어요.`);
  }

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  return (
    <div className="page wide">
      {toast.element}
      <header className="board-head">
        <div>
          <div className="badges">
            <span className="badge mode">{board.mode === "SOLO" ? "혼자 정리" : "함께 정리"}</span>
            <span className={`badge ${completed ? "done" : "active"}`}>{completed ? "정산 완료" : "정산 진행 중"}</span>
            {board.viewerIsOwner ? <span className="badge owner">총대</span> : null}
          </div>
          <h1>{board.name}</h1>
          <div className="avatars">
            {board.members.map((m, i) => (
              <Avatar key={m.id} name={m.id === board.viewerMemberId ? "나" : m.nickname} index={i} />
            ))}
            <small>{board.members.length}명</small>
          </div>
        </div>
        <div className="board-actions">
          {completed ? (
            <button type="button" className="primary-button" onClick={() => setCardOpen(true)}>
              정산표 보기 · 꾸미기
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={() => setReceiptModal({ receipt: null })}>
              + 영수증 추가
            </button>
          )}
          {board.viewerIsOwner ? (
            <details className="more-menu" ref={menuRef}>
              <summary className="icon-button" aria-label="모임 관리">
                ⋯
              </summary>
              <div role="menu">
                <button type="button" role="menuitem" onClick={() => { closeMenu(); setRenameOpen(true); }}>
                  모임명 수정
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => { closeMenu(); setDeleteOpen(true); }}>
                  정산 삭제
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </header>

      <section className="board-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Settlement</span>
            <h2>정산 현황</h2>
          </div>
          <p>{completed ? "총대가 정산을 완료했어요" : "참여자를 누르면 그 사람이 올린 영수증을 볼 수 있어요"}</p>
        </div>
        <div className="balance-grid">
          {board.members.map((m) => {
            const b = board.balances.find((x) => x.memberId === m.id)!;
            return (
              <article key={m.id} className={`balance-card${filterMemberId === m.id ? " selected" : ""}`}>
                <button
                  type="button"
                  className="balance-card-filter"
                  aria-label={`${m.nickname}님이 올린 영수증 보기`}
                  aria-pressed={filterMemberId === m.id}
                  onClick={() => {
                    setFilterMemberId(m.id);
                    setSelectedReceiptId(null);
                  }}
                />
                <div className="balance-card-head">
                  <span className="initial">{m.nickname.slice(0, 1)}</span>
                  {m.nickname} {m.isOwner ? "🔫" : "💛"}
                </div>
                <dl>
                  <div>
                    <dt>결제</dt>
                    <dd>{formatWon(b.paid)}</dd>
                  </div>
                  <div>
                    <dt>내 몫</dt>
                    <dd>{formatWon(b.owes)}</dd>
                  </div>
                </dl>
                <p className={`verdict${b.balance < 0 ? " send" : ""}`}>
                  {b.balance > 0
                    ? `${formatWon(b.balance)} 받기`
                    : b.balance < 0
                      ? `${formatWon(-b.balance)} 보내기`
                      : "주고받을 금액 없음"}
                </p>
                {board.viewerIsOwner && m.isGuest && !completed ? (
                  <button type="button" className="secondary-button compact reissue" disabled={busy} onClick={() => reissue(m.id, m.nickname)}>
                    접속 링크 재발급
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
        {board.transfers.length ? (
          <div className="transfer-bar">
            <strong>최소 송금 안내</strong>
            {board.transfers.map((t) => (
              <span className="transfer-chip" key={`${t.fromMemberId}-${t.toMemberId}`}>
                {nickname.get(t.fromMemberId)} → {nickname.get(t.toMemberId)}
                <b>{formatWon(t.amount)}</b>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="board-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Receipts</span>
            <h2>영수증 내역</h2>
          </div>
          <p>
            <b>
              {filterName} 등록 · 총 {formatWon(filteredTotal)}
            </b>
          </p>
        </div>
        {filtered.length ? (
          <div className="panel receipt-panel">
            <div className="receipt-list" aria-label="영수증 목록">
              {filtered.map((r) => (
                <button key={r.id} type="button" aria-pressed={selected?.id === r.id} onClick={() => setSelectedReceiptId(r.id)}>
                  <span className="glyph" aria-hidden="true">
                    ⌁
                  </span>
                  <span>
                    <strong>{r.storeName}</strong>
                    <small>{r.items.length}개 메뉴</small>
                  </span>
                  <b>{formatWon(r.total)}</b>
                </button>
              ))}
            </div>
            {selected ? (
              <article className="receipt-detail">
                <header className="receipt-detail-head">
                  <div>
                    <time dateTime={selected.createdAt} suppressHydrationWarning>{formatDate(selected.createdAt)}</time>
                    <h3>{selected.storeName}</h3>
                    <small>{nickname.get(selected.paidByMemberId) ?? "알 수 없는 참여자"}님이 결제</small>
                  </div>
                  {canEditReceipt(selected) ? (
                    <div className="actions">
                      <button type="button" className="text-button" onClick={() => setReceiptModal({ receipt: selected })}>
                        수정
                      </button>
                      <button
                        type="button"
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`${selected.storeName} 영수증을 삭제할까요?`)) {
                            act({ action: "deleteReceipt", receiptId: selected.id }, "영수증을 삭제했어요.");
                          }
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </header>
                {selected.items.map((item, i) => (
                  <div className="receipt-item" key={i}>
                    <div className="receipt-item-head">
                      <div>
                        <strong>{item.menu_name}</strong>
                        <small>
                          {formatWon(item.unit_price)} × {item.quantity}
                        </small>
                      </div>
                      <strong>{formatWon(item.unit_price * item.quantity)}</strong>
                    </div>
                    <p className="eaters">먹은 사람</p>
                    <div className="chips">
                      {item.consumer_member_ids.map((id) => (
                        <span className="chip" key={id}>
                          {nickname.get(id) ?? "알 수 없는 참여자"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="receipt-total">
                  <span>영수증 합계</span>
                  <strong>{formatWon(selected.total)}</strong>
                </div>
              </article>
            ) : null}
          </div>
        ) : (
          <div className="panel empty-state">
            <span className="empty-icon" aria-hidden="true">
              🧾
            </span>
            <h3>{filterName}님이 등록한 영수증이 없어요</h3>
            <p>위에서 다른 참여자를 누르면 그 사람이 직접 올린 영수증을 볼 수 있어요.</p>
            {!completed && filterMemberId === board.viewerMemberId ? (
              <button type="button" className="primary-button" onClick={() => setReceiptModal({ receipt: null })}>
                영수증 추가
              </button>
            ) : null}
          </div>
        )}
      </section>

      {board.viewerIsOwner && !completed ? (
        <section className="panel complete-bar">
          <div>
            <strong>모든 영수증을 확인했나요?</strong>
            <p>완료 후에는 영수증과 참여 내역을 더 이상 바꿀 수 없어요.</p>
          </div>
          <button type="button" className="primary-button" onClick={completeSettlement} disabled={busy || !board.receipts.length}>
            정산 완료
          </button>
        </section>
      ) : null}

      {receiptModal ? (
        <ReceiptModal
          board={board}
          receipt={receiptModal.receipt}
          onClose={() => setReceiptModal(null)}
          onSaved={(message) => {
            setReceiptModal(null);
            setFilterMemberId(board.viewerMemberId);
            toast.show(message);
            router.refresh();
          }}
        />
      ) : null}

      <RenameModal
        open={renameOpen}
        initial={board.name}
        onClose={() => setRenameOpen(false)}
        onSubmit={async (name) => {
          if (await act({ action: "rename", name }, "모임명을 수정했어요.")) setRenameOpen(false);
        }}
      />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} labelledBy="delete-title">
        <button type="button" className="modal-close" aria-label="닫기" onClick={() => setDeleteOpen(false)}>
          ×
        </button>
        <div className="modal-head">
          <span className="success-mark" style={{ background: "#fdeeee", color: "var(--danger)" }}>
            !
          </span>
          <span className="eyebrow" style={{ color: "var(--danger)" }}>
            정산 삭제
          </span>
          <h2 id="delete-title">이 정산을 삭제할까요?</h2>
          <p>
            <b>{board.name}</b> 정산이 모든 참여자의 목록에서 사라지고 기존 초대 링크도 사용할 수 없어요.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={() => setDeleteOpen(false)}>
            취소
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/groups/${board.id}`, { body: { action: "deleteGroup" } });
                router.replace("/?view=all");
                router.refresh();
              } catch (e) {
                toast.show((e as Error).message, "error");
                setBusy(false);
              }
            }}
          >
            정산 삭제
          </button>
        </div>
      </Modal>

      {completed ? (
        <SettlementCardDialog
          open={cardOpen}
          onClose={() => setCardOpen(false)}
          board={board}
          canArchive={canArchive}
          archives={archives}
          onArchived={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function RenameModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="rename-title">
      <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
        ×
      </button>
      <div className="modal-head">
        <span className="eyebrow">모임 관리</span>
        <h2 id="rename-title">모임명 수정</h2>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
          if (name) onSubmit(name);
        }}
      >
        <label className="field">
          <span>모임명</span>
          <input name="name" defaultValue={initial} maxLength={40} required autoFocus />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary-button">
            수정하기
          </button>
        </div>
      </form>
    </Modal>
  );
}
