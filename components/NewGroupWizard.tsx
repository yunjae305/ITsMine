"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Modal } from "./ui";
import { InviteLinks } from "./InviteLinks";

type Mode = "SOLO" | "TOGETHER";
const STEP_LABELS = ["방식", "참여자", "확인"];

export function NewGroupWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="wizard-title">
      <WizardBody onClose={onClose} />
    </Modal>
  );
}

function WizardBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState("");
  const [guests, setGuests] = useState<string[]>([""]);
  const [count, setCount] = useState(4);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ groupId: string; inviteTokens: string[] } | null>(null);

  const guestNames = guests.map((g) => g.trim()).filter(Boolean);
  const total = mode === "SOLO" ? guestNames.length + 1 : count;

  function next() {
    setError("");
    if (step === 0 && !mode) return setError("정산 방식을 선택해 주세요.");
    if (step === 1) {
      if (!name.trim()) return setError("모임 이름을 입력해 주세요.");
      if (mode === "SOLO" && !guestNames.length) return setError("참여자 이름을 한 명 이상 입력해 주세요.");
      if (mode === "SOLO" && new Set([...guestNames]).size !== guestNames.length) return setError("참여자 이름이 겹치지 않게 입력해 주세요.");
      if (mode === "TOGETHER" && (!Number.isInteger(count) || count < 2 || count > 30)) {
        return setError("나를 포함한 전체 인원을 2명 이상 입력해 주세요.");
      }
    }
    setStep((s) => s + 1);
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ groupId: string; inviteTokens: string[] }>("/api/groups", {
        body: { mode, name: name.trim(), guestNames, expectedMemberCount: total },
      });
      if (mode === "SOLO") {
        router.push(`/groups/${result.groupId}`);
        return;
      }
      setCreated(result);
      setBusy(false);
    } catch (e) {
      setError((e as Error).message || "모임을 만들지 못했어요.");
      setBusy(false);
    }
  }

  if (created) {
    return (
      <>
        <div className="modal-head">
          <span className="success-mark">✓</span>
          <h2 id="wizard-title">모임 생성 완료</h2>
          <p>
            <strong>{name}</strong>
            <br />
            각 링크를 한 사람씩 보내 주세요. 링크 하나당 한 명만 참여할 수 있어요.
          </p>
        </div>
        <InviteLinks groupName={name} tokens={created.inviteTokens} />
        <div className="modal-actions">
          <button type="button" className="primary-button block" onClick={() => router.push(`/groups/${created.groupId}`)}>
            모임 보드로 이동
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
        ×
      </button>
      <div className="modal-head">
        <span className="eyebrow">새 더치페이</span>
        <h2 id="wizard-title">모임 만들기</h2>
      </div>
      <ol className="wizard-steps" aria-label="모임 만들기 단계">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "current" : ""} aria-current={i === step ? "step" : undefined}>
            <b>{i + 1}</b>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="mode-options">
          <button type="button" className="mode-option" aria-pressed={mode === "SOLO"} onClick={() => setMode("SOLO")}>
            <span className="emoji">✍️</span>
            <span>
              <strong>혼자 정리하기</strong>
              <small>내가 참여자와 영수증을 전부 입력해요</small>
            </span>
          </button>
          <button type="button" className="mode-option" aria-pressed={mode === "TOGETHER"} onClick={() => setMode("TOGETHER")}>
            <span className="emoji">🙌</span>
            <span>
              <strong>함께 정리하기</strong>
              <small>링크를 공유하고 각자 모임에 참여해요</small>
            </span>
          </button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="stack">
          <label className="field">
            <span>모임 이름</span>
            <input value={name} maxLength={40} placeholder="토요일 저녁 모임" autoFocus onChange={(e) => setName(e.target.value)} />
          </label>
          {mode === "SOLO" ? (
            <div className="field">
              <span>참여자 이름</span>
              <p className="hint">나는 자동으로 포함돼요</p>
              <div className="participant-rows">
                {guests.map((g, i) => (
                  <div className="participant-row" key={i}>
                    <input
                      className="input"
                      value={g}
                      maxLength={20}
                      aria-label={`참여자 ${i + 1}`}
                      placeholder={`친구 ${i + 1}`}
                      onChange={(e) => setGuests((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                    {guests.length > 1 ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`참여자 ${i + 1} 삭제`}
                        onClick={() => setGuests((list) => list.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button type="button" className="text-button" style={{ justifySelf: "start" }} onClick={() => setGuests((l) => [...l, ""])} disabled={guests.length >= 29}>
                + 참여자 추가
              </button>
            </div>
          ) : (
            <label className="field">
              <span>전체 인원</span>
              <span className="count-input">
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={30}
                  value={Number.isNaN(count) ? "" : count}
                  onChange={(e) => setCount(e.target.valueAsNumber)}
                />
                <span className="hint">명 · 나 포함</span>
              </span>
            </label>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <dl className="summary-list">
          <div>
            <dt>방식</dt>
            <dd>{mode === "SOLO" ? "혼자 정리하기" : "함께 정리하기"}</dd>
          </div>
          <div>
            <dt>모임</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>인원</dt>
            <dd>{total}명</dd>
          </div>
        </dl>
      ) : null}

      {error ? <p className="form-error" style={{ marginTop: 14 }}>{error}</p> : null}

      <div className="modal-actions">
        {step > 0 ? (
          <button type="button" className="secondary-button" onClick={() => { setError(""); setStep((s) => s - 1); }}>
            이전
          </button>
        ) : null}
        {step < 2 ? (
          <button type="button" className="primary-button" onClick={next}>
            다음
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={create} disabled={busy}>
            {busy ? "만드는 중..." : "모임 시작하기"}
          </button>
        )}
      </div>
    </>
  );
}
