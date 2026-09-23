"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { NotificationView } from "@/lib/groups";
import { api, Modal } from "./ui";

export function HeaderActions({ user, notifications }: { user: CurrentUser; notifications: NotificationView[] }) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [nickname, setNickname] = useState(user.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  async function onToggleNotifications(open: boolean) {
    if (open && unread) {
      await api("/api/notifications").catch(() => undefined);
      router.refresh();
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/profile", { method: "PATCH", body: { nickname } });
      setProfileOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    await api("/api/auth/logout").catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <details
        className="notification-menu"
        ref={menuRef}
        onToggle={(e) => onToggleNotifications((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="icon-button notification-button" aria-label="알림" title="알림">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
          {unread ? <span className="notification-badge">{unread}</span> : null}
        </summary>
        <section className="notification-panel" aria-label="알림 목록">
          <header>
            <strong>알림</strong>
            {notifications.length ? <span>{notifications.length}</span> : null}
          </header>
          {notifications.length ? (
            <div className="notification-list">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.groupId ? `/groups/${n.groupId}` : "/"}
                  className={n.read ? "" : "unread"}
                  onClick={() => menuRef.current?.removeAttribute("open")}
                >
                  <i aria-hidden="true" />
                  <span>
                    <strong>{n.title}</strong>
                    <small>{n.body}</small>
                    <time dateTime={n.createdAt} suppressHydrationWarning>
                      {formatDateTime(n.createdAt)}
                    </time>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="notification-empty">
              <strong>알림이 없어요</strong>
              새로운 소식이 생기면 여기에 알려드릴게요
            </div>
          )}
        </section>
      </details>
      <button type="button" className="secondary-button" onClick={() => setProfileOpen(true)}>
        회원 정보
      </button>
      <button type="button" className="secondary-button" onClick={logout} disabled={busy}>
        {busy ? "로그아웃 중…" : "로그아웃"}
      </button>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} labelledBy="profile-title">
        <button type="button" className="modal-close" aria-label="닫기" onClick={() => setProfileOpen(false)}>
          ×
        </button>
        <div className="modal-head">
          <span className="eyebrow">My account</span>
          <h2 id="profile-title">회원 정보</h2>
        </div>
        <form className="stack" onSubmit={saveProfile}>
          <div className="field">
            <span>이메일</span>
            <p className="hint">{user.email}</p>
          </div>
          <label className="field">
            <span>닉네임</span>
            <input name="nickname" value={nickname} maxLength={20} required onChange={(e) => setNickname(e.target.value)} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setProfileOpen(false)}>
              취소
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              저장
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
