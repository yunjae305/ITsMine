"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "POST",
    headers: init?.form ? undefined : { "Content-Type": "application/json" },
    body: init?.form ?? (init?.body === undefined ? undefined : JSON.stringify(init.body)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? "다시 시도해 주세요.");
  return data as T;
}

export function Modal({
  open,
  onClose,
  className = "modal",
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}

export type ToastState = { message: string; tone: "info" | "error" } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((message: string, tone: "info" | "error" = "info") => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const element = toast ? (
    <div className={`toast${toast.tone === "error" ? " error" : ""}`} role="status">
      {toast.message}
      <button type="button" aria-label="알림 닫기" onClick={() => setToast(null)}>
        ×
      </button>
    </div>
  ) : null;
  return { show, element };
}

const AVATAR_COLORS = ["#6d7cf0", "#8a6fd1", "#3f9a86", "#e28a4f", "#d65272", "#4d9ad8", "#9a8a3f", "#5a6780"];

export function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span className="avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }} title={name}>
      {name.slice(0, 1)}
    </span>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
