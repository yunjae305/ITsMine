"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatLongDate as formatDate } from "@/lib/format";
import type { ArchiveView } from "@/lib/groups";
import { api, Modal } from "./ui";

export function ArchiveGrid({ archives }: { archives: ArchiveView[] }) {
  const router = useRouter();
  const [viewing, setViewing] = useState<ArchiveView | null>(null);
  const [error, setError] = useState("");

  async function remove(archive: ArchiveView) {
    if (!window.confirm(`${archive.title} 정산표를 아카이브에서 삭제할까요?`)) return;
    try {
      await api(`/api/archive/${archive.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="archive-grid">
        {archives.map((a) => (
          <article className="archive-card" key={a.id}>
            <a
              className="archive-thumb"
              href={`/api/archive/${a.id}`}
              aria-label={`${a.title} 정산표 크게 보기`}
              onClick={(e) => {
                e.preventDefault();
                setViewing(a);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/archive/${a.id}`} alt={`${a.title} 정산표`} loading="lazy" />
              <span>크게 보기</span>
            </a>
            <footer>
              <div>
                <strong>{a.title}</strong>
                <small suppressHydrationWarning>{formatDate(a.createdAt)}</small>
              </div>
              <details className="more-menu">
                <summary className="icon-button" aria-label="정산표 관리">
                  ⋯
                </summary>
                <div role="menu">
                  <a role="menuitem" href={`/groups/${a.groupId}`}>
                    정산 보러 가기
                  </a>
                  <a role="menuitem" href={`/api/archive/${a.id}`} download={`${a.title}-정산표.png`}>
                    이미지 저장
                  </a>
                  <button type="button" role="menuitem" className="danger" onClick={() => remove(a)}>
                    삭제
                  </button>
                </div>
              </details>
            </footer>
          </article>
        ))}
      </div>
      <Modal open={!!viewing} onClose={() => setViewing(null)} className="modal wide lightbox" labelledBy="lightbox-title">
        {viewing ? (
          <>
            <button type="button" className="modal-close" aria-label="닫기" onClick={() => setViewing(null)}>
              ×
            </button>
            <div className="modal-head">
              <h2 id="lightbox-title">{viewing.title}</h2>
              <p>{formatDate(viewing.createdAt)}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/archive/${viewing.id}`} alt={`${viewing.title} 정산표`} />
          </>
        ) : null}
      </Modal>
    </>
  );
}
