"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./ui";

export function InviteJoin({
  token,
  groupName,
  joined,
  expected,
  reconnectNickname,
  defaultNickname,
}: {
  token: string;
  groupName: string;
  joined: number;
  expected: number;
  reconnectNickname: string | null;
  defaultNickname: string;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(defaultNickname);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { groupId } = await api<{ groupId: string }>(`/api/invites/${token}`, {
        body: reconnectNickname ? {} : { nickname: nickname.trim() },
      });
      router.push(`/groups/${groupId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <span className="eyebrow">{reconnectNickname ? "다시 접속하기" : "함께 정리 초대"}</span>
      <h1>{groupName}</h1>
      <p>먹은 메뉴를 함께 고르고 정확하게 나눠요</p>
      {!reconnectNickname ? (
        <div className="join-progress">
          <header>
            <span>참여 현황</span>
            <span>
              {joined} / {expected}명
            </span>
          </header>
          <div className="progress-track" aria-hidden="true">
            <div style={{ width: `${(joined / expected) * 100}%` }} />
          </div>
        </div>
      ) : null}
      <form onSubmit={join}>
        {reconnectNickname ? (
          <p className="hint" style={{ marginTop: 20 }}>
            <b>{reconnectNickname}</b>님 자리로 이 기기를 연결해요. 이전 기기에서는 더 이상 접속할 수 없어요.
          </p>
        ) : (
          <label className="field">
            <span>모임에서 사용할 닉네임</span>
            <input value={nickname} maxLength={20} required placeholder="예: 민수" onChange={(e) => setNickname(e.target.value)} />
          </label>
        )}
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "참여하는 중..." : reconnectNickname ? `${reconnectNickname}님으로 접속하기` : "가입 없이 참여하기"}
        </button>
        <p className="hint">닉네임과 정산 정보만 이 모임에 저장돼요.</p>
      </form>
    </>
  );
}
