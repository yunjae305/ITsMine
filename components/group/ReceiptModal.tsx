"use client";

import { useState } from "react";
import type { BoardReceipt, GroupBoard } from "@/lib/groups";
import { formatWon } from "@/lib/settlement";
import { api, Modal } from "../ui";

type Draft = { menu_name: string; quantity: string; unit_price: string; consumer_member_ids: string[] };

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function toInt(value: string) {
  const n = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function ReceiptModal({
  board,
  receipt,
  onClose,
  onSaved,
}: {
  board: GroupBoard;
  receipt: BoardReceipt | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const me = board.viewerMemberId;
  const canChoosePayer = board.mode === "SOLO" && board.viewerIsOwner;
  const [tab, setTab] = useState<"manual" | "photo">("manual");
  const [storeName, setStoreName] = useState(receipt?.storeName ?? "");
  const [payer, setPayer] = useState(receipt?.paidByMemberId ?? me);
  const [items, setItems] = useState<Draft[]>(
    receipt?.items.map((i) => ({
      menu_name: i.menu_name,
      quantity: String(i.quantity),
      unit_price: String(i.unit_price),
      consumer_member_ids: i.consumer_member_ids,
    })) ?? [{ menu_name: "", quantity: "1", unit_price: "", consumer_member_ids: [me] }],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const total = items.reduce((s, i) => s + toInt(i.quantity) * toInt(i.unit_price), 0);

  function update(index: number, patch: Partial<Draft>) {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function toggleConsumer(index: number, memberId: string) {
    setItems((list) =>
      list.map((item, i) => {
        if (i !== index) return item;
        const has = item.consumer_member_ids.includes(memberId);
        return {
          ...item,
          consumer_member_ids: has
            ? item.consumer_member_ids.filter((id) => id !== memberId)
            : board.members.map((m) => m.id).filter((id) => id === memberId || item.consumer_member_ids.includes(id)),
        };
      }),
    );
  }

  async function scan(file: File) {
    setScanMessage("");
    setError("");
    if (!["image/jpeg", "image/png"].includes(file.type)) return setScanMessage("JPG 또는 PNG 사진만 올릴 수 있어요.");
    if (file.size > MAX_PHOTO_BYTES) return setScanMessage("사진은 최대 10MB까지 올릴 수 있어요.");
    const form = new FormData();
    form.append("image", file);
    setScanning(true);
    try {
      const result = await api<{ store_name: string; items: { menu_name: string; quantity: number; unit_price: number }[] }>(
        "/api/receipts/scan",
        { form },
      );
      if (result.store_name) setStoreName(result.store_name);
      setItems(
        result.items.map((i) => ({
          menu_name: i.menu_name,
          quantity: String(i.quantity),
          unit_price: String(i.unit_price),
          consumer_member_ids: [payer],
        })),
      );
      setScanMessage(`✓ 메뉴 ${result.items.length}개 인식 완료 · 금액과 먹은 사람을 확인해 주세요.`);
      setTab("manual");
    } catch (e) {
      setScanMessage((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!storeName.trim()) return setError("가게 이름을 입력해 주세요.");
    if (items.some((i) => !i.menu_name.trim())) return setError("메뉴 이름을 모두 입력해 주세요.");
    if (items.some((i) => toInt(i.quantity) < 1)) return setError("수량은 1 이상이어야 해요.");
    if (items.some((i) => i.unit_price.trim() === "")) return setError("금액은 0 이상의 정수여야 합니다.");
    if (items.some((i) => !i.consumer_member_ids.length)) return setError("모든 메뉴에서 먹은 사람을 한 명 이상 선택해 주세요.");
    setBusy(true);
    try {
      await api(`/api/groups/${board.id}`, {
        body: {
          action: "saveReceipt",
          receipt: {
            id: receipt?.id,
            store_name: storeName.trim(),
            paid_by_member_id: payer,
            items: items.map((i) => ({
              menu_name: i.menu_name.trim(),
              quantity: toInt(i.quantity),
              unit_price: toInt(i.unit_price),
              consumer_member_ids: i.consumer_member_ids,
            })),
          },
        },
      });
      onSaved(receipt ? "영수증을 수정했어요." : "영수증을 저장했어요.");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const myName = board.members.find((m) => m.id === me)?.nickname ?? "";

  return (
    <Modal open onClose={onClose} className="modal wide" labelledBy="receipt-title">
      <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
        ×
      </button>
      <div className="modal-head">
        <span className="eyebrow">Receipt</span>
        <h2 id="receipt-title">{receipt ? "영수증 수정" : "영수증 추가"}</h2>
      </div>
      <form className="receipt-form" onSubmit={submit} noValidate>
        {!receipt ? (
          <div className="segmented">
            <button type="button" className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>
              직접 입력
            </button>
            <button type="button" className={tab === "photo" ? "active" : ""} onClick={() => setTab("photo")}>
              사진 선택
            </button>
          </div>
        ) : null}

        {tab === "photo" ? (
          <div className="photo-drop">
            <span className="big" aria-hidden="true">
              📷
            </span>
            <strong>{scanning ? "사진에서 메뉴를 읽고 있어요…" : "영수증 사진을 골라 주세요"}</strong>
            <p className="hint">JPG/PNG · 최대 10MB · 인식 결과는 저장 전에 확인해 주세요.</p>
            <label className={`secondary-button file-button${scanning ? " disabled" : ""}`}>
              {scanning ? "인식 중..." : "사진 선택"}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                disabled={scanning}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) scan(file);
                }}
              />
            </label>
          </div>
        ) : null}
        {scanMessage ? <p className="hint" role="status">{scanMessage}</p> : null}

        <div className="two-col">
          <label className="field">
            <span>가게 이름</span>
            <input value={storeName} maxLength={40} placeholder="OO식당" onChange={(e) => setStoreName(e.target.value)} />
          </label>
          {canChoosePayer ? (
            <label className="field">
              <span>결제한 사람</span>
              <select value={payer} onChange={(e) => setPayer(e.target.value)}>
                {board.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nickname}
                    {m.id === me ? " (나)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>결제한 사람 (본인)</span>
              <input value={myName} readOnly />
            </label>
          )}
        </div>

        <div className="menus-head">
          <div>
            <strong>메뉴별 내역</strong>
            <span className="hint">수량 × 단가와 먹은 사람을 선택하세요</span>
          </div>
          <span className="sum">합계 {formatWon(total)}</span>
        </div>

        {items.map((item, index) => (
          <fieldset className="menu-card" key={index}>
            <legend>메뉴 {index + 1}</legend>
            {items.length > 1 ? (
              <button
                type="button"
                className="remove"
                aria-label={`메뉴 ${index + 1} 삭제`}
                onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
              >
                ×
              </button>
            ) : null}
            <div className="menu-fields">
              <label className="field">
                <span>메뉴 이름</span>
                <input value={item.menu_name} maxLength={40} placeholder="삼겹살" onChange={(e) => update(index, { menu_name: e.target.value })} />
              </label>
              <label className="field">
                <span>수량</span>
                <input type="number" inputMode="numeric" min={1} value={item.quantity} onChange={(e) => update(index, { quantity: e.target.value })} />
              </label>
              <label className="field">
                <span>단가</span>
                <span className="money-input">
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="15000"
                    value={item.unit_price}
                    onChange={(e) => update(index, { unit_price: e.target.value })}
                  />
                  <span>원</span>
                </span>
              </label>
            </div>
            <div className="field">
              <span className="field-label">이 메뉴를 먹은 사람</span>
              <div className="chip-toggles">
                {board.members.map((m) => {
                  const checked = item.consumer_member_ids.includes(m.id);
                  return (
                    <label className="chip-toggle" key={m.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleConsumer(index, m.id)}
                        aria-label={`${m.nickname}${checked ? " 선택됨" : " 미선택"}`}
                      />
                      <span>{m.nickname}</span>
                    </label>
                  );
                })}
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: 13 }}
                  onClick={() => update(index, { consumer_member_ids: board.members.map((m) => m.id) })}
                >
                  모두 선택
                </button>
              </div>
            </div>
            <p className="subtotal">소계 {formatWon(toInt(item.quantity) * toInt(item.unit_price))}</p>
          </fieldset>
        ))}
        <button
          type="button"
          className="text-button"
          style={{ justifySelf: "start" }}
          onClick={() => setItems((list) => [...list, { menu_name: "", quantity: "1", unit_price: "", consumer_member_ids: [] }])}
          disabled={items.length >= 100}
        >
          + 메뉴 추가
        </button>

        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary-button" disabled={busy || scanning}>
            {busy ? "저장 중..." : "영수증 저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
