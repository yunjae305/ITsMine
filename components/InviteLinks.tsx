"use client";

import { useEffect, useState } from "react";
import { copyText } from "./ui";

export async function shareInvite(groupName: string, url: string): Promise<string> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: `${groupName} 더치페이 초대`, text: `${groupName} 정산에 참여해 주세요.`, url });
      return "";
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return "";
    }
  }
  return (await copyText(url))
    ? "초대 링크를 복사했어요. 카카오톡에 붙여 넣어 주세요."
    : "초대 링크를 길게 눌러 복사해 주세요.";
}

export function InviteLinks({ groupName, tokens }: { groupName: string; tokens: string[] }) {
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="invite-list">
      {tokens.map((token, i) => {
        const url = `${origin}/invite/${token}`;
        return (
          <div className="invite-row" key={token}>
            <span className="field-label">참여자 {i + 1}</span>
            <div>
              <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={`참여자 ${i + 1} 초대 링크`} />
              <button type="button" className="secondary-button compact" onClick={async () => setMessage(await shareInvite(groupName, url))}>
                공유
              </button>
            </div>
          </div>
        );
      })}
      {message ? <p className="hint" role="status">{message}</p> : null}
    </div>
  );
}
