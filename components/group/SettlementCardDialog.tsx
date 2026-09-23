"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchiveView, GroupBoard } from "@/lib/groups";
import { api } from "../ui";
import {
  CARD_WIDTH,
  defaultLayers,
  drawCard,
  EMOJI_CHOICES,
  FONT_STYLESHEET,
  FONTS,
  hitTest,
  layerBox,
  MAX_LAYERS,
  newLayerId,
  THEMES,
  themeById,
  type Design,
  type FontId,
  type Layer,
} from "./cardRenderer";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function ensureFontStylesheet() {
  if (document.querySelector(`link[data-card-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_STYLESHEET;
  link.dataset.cardFonts = "true";
  document.head.appendChild(link);
}

export function SettlementCardDialog({
  open,
  onClose,
  board,
  canArchive,
  archives,
  onArchived,
}: {
  open: boolean;
  onClose: () => void;
  board: GroupBoard;
  canArchive: boolean;
  archives: ArchiveView[];
  onArchived: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<"picker" | "editor">(canArchive ? "picker" : "editor");
  // 꾸민 내용은 이 화면을 닫았다 열어도 유지된다(새로고침하면 초기화).
  const [design, setDesign] = useState<Design>(() => ({
    font: "default",
    mode: "template",
    themeId: THEMES[0].id,
    photo: null,
    photoPosition: 0.5,
    layers: defaultLayers(THEMES[0], board.name),
  }));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setView(canArchive ? "picker" : "editor");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, canArchive]);

  return (
    <dialog
      ref={dialogRef}
      className={view === "picker" ? "modal wide" : "settlement-card-dialog"}
      aria-labelledby="card-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {!open ? null : view === "picker" ? (
        <ArchivePicker board={board} archives={archives} onClose={onClose} onCreate={() => setView("editor")} />
      ) : (
        <CardEditor
          board={board}
          design={design}
          setDesign={setDesign}
          canArchive={canArchive}
          onClose={onClose}
          onArchived={onArchived}
        />
      )}
    </dialog>
  );
}

function ArchivePicker({
  board,
  archives,
  onClose,
  onCreate,
}: {
  board: GroupBoard;
  archives: ArchiveView[];
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <>
      <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
        ×
      </button>
      <div className="modal-head">
        <span className="eyebrow">Settlement archive</span>
        <h2 id="card-title">{board.name} 정산표</h2>
        <p>저장한 정산표를 다시 보거나 새로 만들 수 있어요</p>
      </div>
      <div className="archive-picker-grid">
        <button type="button" className="archive-create" onClick={onCreate}>
          <span className="plus" aria-hidden="true">
            +
          </span>
          <strong>새 정산표 만들기</strong>
          <small>새롭게 꾸미고 저장하기</small>
        </button>
        {archives.map((a) => (
          <a key={a.id} href={`/api/archive/${a.id}`} target="_blank" rel="noreferrer" aria-label={`${a.title} 정산표 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/archive/${a.id}`} alt={`${a.title} 정산표`} loading="lazy" />
          </a>
        ))}
      </div>
      <div className="modal-actions">
        <Link className="text-button" href="/archive">
          전체 아카이브 보기 →
        </Link>
      </div>
    </>
  );
}

type Drag =
  | { type: "move"; id: string; dx: number; dy: number }
  | { type: "transform"; id: string; cx: number; cy: number; startDist: number; startAngle: number; size: number; rotation: number }
  | { type: "pinch"; id: string; startDist: number; startAngle: number; size: number; rotation: number };

function CardEditor({
  board,
  design,
  setDesign,
  canArchive,
  onClose,
  onArchived,
}: {
  board: GroupBoard;
  design: Design;
  setDesign: React.Dispatch<React.SetStateAction<Design>>;
  canArchive: boolean;
  onClose: () => void;
  onArchived: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [height, setHeight] = useState(800);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [fontsTick, setFontsTick] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [archiveState, setArchiveState] = useState<"idle" | "saving" | "saved">("idle");
  const [message, setMessage] = useState("");
  const [emojiInput, setEmojiInput] = useState("");
  const [captionInput, setCaptionInput] = useState("");

  const selected = design.layers.find((l) => l.id === selectedId) ?? null;
  const theme = themeById(design.themeId);

  const updateLayer = useCallback(
    (id: string, patch: Partial<Layer>) =>
      setDesign((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
    [setDesign],
  );

  // 글꼴 불러오기
  useEffect(() => {
    ensureFontStylesheet();
    const family = FONTS.find((f) => f.id === design.font)?.family;
    if (!family) return;
    document.fonts.load(`700 24px "${family}"`, "몫대로가나다123").then(() => setFontsTick((t) => t + 1)).catch(() => undefined);
  }, [design.font]);

  // 꾸미기를 바꾸면 다시 아카이브에 저장할 수 있다.
  useEffect(() => setArchiveState((s) => (s === "saved" ? "idle" : s)), [design]);

  // 그리기 + 내보내기 이미지 갱신
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHeight(drawCard(canvas, board, design));
    let revoked = false;
    let url: string | null = null;
    const timer = setTimeout(() => {
      canvas.toBlob((blob) => {
        if (!blob || revoked) return;
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      }, "image/png");
    }, 250);
    return () => {
      revoked = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [board, design, fontsTick]);

  function toCard(clientX: number, clientY: number) {
    const rect = areaRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CARD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (preview) return;
    const point = toCard(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointers.current.size === 2 && selected) {
      const [a, b] = [...pointers.current.values()];
      dragRef.current = {
        type: "pinch",
        id: selected.id,
        startDist: Math.hypot(b.x - a.x, b.y - a.y),
        startAngle: Math.atan2(b.y - a.y, b.x - a.x),
        size: selected.size,
        rotation: selected.rotation,
      };
      return;
    }
    const ctx = canvasRef.current!.getContext("2d")!;
    const hit = hitTest(ctx, design.layers, design.font, point.x, point.y);
    setSelectedId(hit?.id ?? null);
    dragRef.current = hit ? { type: "move", id: hit.id, dx: point.x - hit.x, dy: point.y - hit.y } : null;
  }

  function onPointerMove(event: React.PointerEvent) {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "move") {
      const point = toCard(event.clientX, event.clientY);
      updateLayer(drag.id, {
        x: Math.min(Math.max(point.x - drag.dx, 0), CARD_WIDTH),
        y: Math.min(Math.max(point.y - drag.dy, 0), height),
      });
    } else if (drag.type === "transform") {
      const point = toCard(event.clientX, event.clientY);
      const dist = Math.hypot(point.x - drag.cx, point.y - drag.cy);
      const angle = Math.atan2(point.y - drag.cy, point.x - drag.cx);
      updateLayer(drag.id, {
        size: Math.min(Math.max((drag.size * dist) / drag.startDist, 12), 220),
        rotation: drag.rotation + angle - drag.startAngle,
      });
    } else if (drag.type === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      updateLayer(drag.id, {
        size: Math.min(Math.max((drag.size * dist) / drag.startDist, 12), 220),
        rotation: drag.rotation + angle - drag.startAngle,
      });
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) dragRef.current = null;
  }

  function startTransform(event: React.PointerEvent) {
    if (!selected) return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const point = toCard(event.clientX, event.clientY);
    dragRef.current = {
      type: "transform",
      id: selected.id,
      cx: selected.x,
      cy: selected.y,
      startDist: Math.max(Math.hypot(point.x - selected.x, point.y - selected.y), 1),
      startAngle: Math.atan2(point.y - selected.y, point.x - selected.x),
      size: selected.size,
      rotation: selected.rotation,
    };
  }

  function removeLayer(id: string) {
    setDesign((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!selected) return;
    const step = event.shiftKey ? 20 : 4;
    const keyMap: Record<string, Partial<Layer>> = {
      ArrowLeft: { x: selected.x - step },
      ArrowRight: { x: selected.x + step },
      ArrowUp: { y: selected.y - step },
      ArrowDown: { y: selected.y + step },
      "+": { size: Math.min(selected.size * 1.1, 220) },
      "=": { size: Math.min(selected.size * 1.1, 220) },
      "-": { size: Math.max(selected.size / 1.1, 12) },
      "[": { rotation: selected.rotation - Math.PI / 24 },
      "]": { rotation: selected.rotation + Math.PI / 24 },
    };
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeLayer(selected.id);
    } else if (keyMap[event.key]) {
      event.preventDefault();
      updateLayer(selected.id, keyMap[event.key]);
    }
  }

  function addLayer(kind: Layer["kind"], text: string) {
    if (design.layers.length >= MAX_LAYERS) {
      setMessage(`스티커와 문구는 최대 ${MAX_LAYERS}개까지 붙일 수 있어요.`);
      return;
    }
    setMessage("");
    const layer: Layer = {
      id: newLayerId(),
      kind,
      text,
      x: CARD_WIDTH / 2 + (Math.random() - 0.5) * 120,
      y: 150 + (Math.random() - 0.5) * 80,
      size: kind === "emoji" ? 60 : 24,
      rotation: 0,
      color: "#232638",
    };
    setDesign((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelectedId(layer.id);
  }

  function changeTheme(themeId: string) {
    setDesign((d) => ({ ...d, themeId, layers: defaultLayers(themeById(themeId), board.name) }));
    setSelectedId(null);
  }

  function loadPhoto(file: File) {
    setMessage("");
    if (file.size > MAX_PHOTO_BYTES) return setMessage("사진은 최대 10MB까지 넣을 수 있어요.");
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setDesign((d) => ({ ...d, mode: "photo", photo: image, photoPosition: 0.5 }));
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setMessage("이 사진은 브라우저에서 열 수 없어요. JPG·PNG·WEBP 사진을 골라 주세요.");
    };
    image.src = url;
  }

  async function saveToArchive() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setArchiveState("saving");
    setMessage("");
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setArchiveState("idle");
      return setMessage("정산표 이미지를 만들지 못했어요.");
    }
    const form = new FormData();
    form.append("groupId", board.id);
    form.append("image", blob, "settlement.png");
    try {
      await api("/api/archive", { form });
      setArchiveState("saved");
      onArchived();
    } catch (e) {
      setArchiveState("idle");
      setMessage((e as Error).message);
    }
  }

  // 선택 상자 위치(카드 좌표 → %)
  let selection: React.CSSProperties | null = null;
  if (selected && !preview && canvasRef.current) {
    const box = layerBox(canvasRef.current.getContext("2d")!, selected, design.font);
    selection = {
      left: `${((selected.x - box.width / 2) / CARD_WIDTH) * 100}%`,
      top: `${((selected.y - box.height / 2) / height) * 100}%`,
      width: `${(box.width / CARD_WIDTH) * 100}%`,
      height: `${(box.height / height) * 100}%`,
      transform: `rotate(${selected.rotation}rad)`,
    };
  }

  return (
    <>
      <header className="settlement-card-heading">
        <button type="button" className="modal-close" aria-label="정산표 닫기" onClick={onClose}>
          ×
        </button>
        <h2 id="card-title">정산표 꾸미기</h2>
        <button type="button" className="text-button" onClick={() => { setPreview((p) => !p); setSelectedId(null); }}>
          {preview ? "편집하기" : "미리보기"}
        </button>
      </header>
      <div className={`settlement-card-layout${preview ? " preview-only" : ""}`}>
        <div className="settlement-card-preview" style={{ background: design.mode === "photo" ? "#f4f5f9" : theme.background + "88" }}>
          <div className="settlement-card-artwork">
            <canvas ref={canvasRef} role="img" aria-label={`${board.name} 정산표 미리보기`} />
            {!preview ? (
              <div
                ref={areaRef}
                className="settlement-card-drag-area"
                tabIndex={0}
                aria-label="정산표 꾸미기 영역"
                aria-describedby="card-keyboard-help"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
              >
                {selection && selected ? (
                  <div className="settlement-selection" style={selection}>
                    <button
                      type="button"
                      className="settlement-layer-handle settlement-layer-delete"
                      aria-label="선택한 레이어 삭제"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeLayer(selected.id)}
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      className="settlement-layer-handle settlement-layer-transform"
                      aria-label="선택한 레이어 크기와 회전 조절"
                      onPointerDown={startTransform}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                    >
                      ↗
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {!preview ? (
            <p className="settlement-help">
              눌러서 선택 · ↗ 손잡이로 크기·회전 · × 삭제
              <br />두 손가락으로도 확대·회전할 수 있어요.
            </p>
          ) : null}
          <p id="card-keyboard-help" className="sr-only">
            방향키로 이동, Shift를 함께 누르면 크게 이동합니다. 더하기와 빼기로 크기 조절, 대괄호 키로 회전, Delete로 삭제합니다.
          </p>
        </div>

        {preview ? (
          <ExportButtons
            canArchive={canArchive}
            archiveState={archiveState}
            imageUrl={imageUrl}
            fileName={`${board.name}-정산표.png`}
            onArchive={saveToArchive}
            message={message}
          />
        ) : (
          <div className="settlement-card-tools">
            <section className="tool-section">
              <header>
                <strong>정산표 글꼴</strong>
              </header>
              <select
                className="input"
                aria-label="정산표 글꼴"
                value={design.font}
                onChange={(e) => setDesign((d) => ({ ...d, font: e.target.value as FontId }))}
              >
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="hint">모임 이름·문구·정산 내역에 함께 적용돼요. 글꼴은 자동으로 불러오므로 기기에 설치하지 않아도 돼요.</p>
            </section>

            <div className="segmented">
              <button type="button" className={design.mode === "template" ? "active" : ""} onClick={() => setDesign((d) => ({ ...d, mode: "template" }))}>
                템플릿으로 만들기
              </button>
              <button type="button" className={design.mode === "photo" ? "active" : ""} onClick={() => setDesign((d) => ({ ...d, mode: "photo" }))}>
                내 사진으로 만들기
              </button>
            </div>

            {design.mode === "template" ? (
              <section className="tool-section">
                <header>
                  <strong>템플릿 고르기</strong>
                  <small>{THEMES.length}가지</small>
                </header>
                <div className="theme-options">
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={t.id === design.themeId} onClick={() => changeTheme(t.id)}>
                      <span aria-hidden="true">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="hint">테마를 바꾸면 스티커 배치가 초기화돼요.</p>
              </section>
            ) : (
              <section className="tool-section">
                <header>
                  <strong>우리 모임 사진</strong>
                </header>
                <div className="photo-controls">
                  <label className="secondary-button file-button">
                    {design.photo ? "사진 바꾸기" : "+ 사진 넣기"}
                    <input
                      type="file"
                      aria-label="모임 사진 선택"
                      accept="image/jpeg,image/png,image/webp,.heic,.heif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) loadPhoto(file);
                      }}
                    />
                  </label>
                  {design.photo ? (
                    <label className="field">
                      <span>사진 위치</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(design.photoPosition * 100)}
                        onChange={(e) => setDesign((d) => ({ ...d, photoPosition: e.target.valueAsNumber / 100 }))}
                      />
                    </label>
                  ) : null}
                </div>
                <p className="hint">
                  사진이 영수증 전체 배경을 채워요. 비율에 따라 일부가 잘릴 수 있고, 사진 위치로 조절할 수 있어요.
                  <br />
                  최대 10MB · 아카이브 저장 전까지는 서버에 업로드하지 않아요.
                </p>
              </section>
            )}

            <section className="tool-section">
              <header>
                <strong>이모지 스티커</strong>
                <small>
                  {design.layers.length}/{MAX_LAYERS}
                </small>
              </header>
              <div className="emoji-options">
                {EMOJI_CHOICES.map((emoji) => (
                  <button key={emoji} type="button" aria-label={`${emoji} 추가`} onClick={() => addLayer("emoji", emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = Array.from(emojiInput.trim()).slice(0, 4).join("");
                  if (!value) return;
                  addLayer("emoji", value);
                  setEmojiInput("");
                }}
              >
                <input
                  className="input"
                  aria-label="직접 입력할 이모지"
                  placeholder="키보드에서 이모지 선택"
                  value={emojiInput}
                  onChange={(e) => setEmojiInput(e.target.value)}
                />
                <button type="submit" className="secondary-button compact">
                  추가
                </button>
              </form>
              <p className="hint">기기의 기본 이모지 모양으로 저장돼요.</p>
            </section>

            <section className="tool-section">
              <header>
                <strong>문구 꾸미기</strong>
              </header>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = captionInput.trim();
                  if (!value) return;
                  addLayer("text", value.slice(0, 24));
                  setCaptionInput("");
                }}
              >
                <input
                  className="input"
                  aria-label="추가할 문구"
                  placeholder="텍스트 입력 (24자)"
                  maxLength={24}
                  value={captionInput}
                  onChange={(e) => setCaptionInput(e.target.value)}
                />
                <button type="submit" className="secondary-button compact">
                  글 추가
                </button>
              </form>
              <div className="layer-list">
                {design.layers.map((l, i) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={l.id === selectedId}
                    aria-label={`스티커 ${i + 1} ${l.text} 편집`}
                    onClick={() => setSelectedId(l.id)}
                  >
                    {l.kind === "emoji" ? l.text : "Aa"}
                  </button>
                ))}
              </div>
              {selected?.kind === "text" ? (
                <div className="layer-editor">
                  <label className="field">
                    <span>문구</span>
                    <input
                      aria-label="선택한 문구 수정"
                      maxLength={40}
                      value={selected.text}
                      onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>글자색</span>
                    <input
                      type="color"
                      aria-label="문구 색상"
                      value={selected.color}
                      onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
                    />
                  </label>
                </div>
              ) : null}
            </section>

            <p className="settlement-card-note">
              사진은 영수증 전체 배경으로, 이모지와 문구는 원하는 위치에 자유롭게 붙일 수 있어요. 정산 금액을 가리지 않도록 배치해 주세요.
              <br />
              꾸민 내용은 이 화면을 닫았다 열어도 유지되지만, 페이지를 새로고침하면 초기화돼요.
            </p>

            <ExportButtons
              canArchive={canArchive}
              archiveState={archiveState}
              imageUrl={imageUrl}
              fileName={`${board.name}-정산표.png`}
              onArchive={saveToArchive}
              message={message}
            />
          </div>
        )}
      </div>
    </>
  );
}

function ExportButtons({
  canArchive,
  archiveState,
  imageUrl,
  fileName,
  onArchive,
  message,
}: {
  canArchive: boolean;
  archiveState: "idle" | "saving" | "saved";
  imageUrl: string | null;
  fileName: string;
  onArchive: () => void;
  message: string;
}) {
  return (
    <div className="settlement-card-export">
      {message ? (
        <p className="form-error" role="alert">
          {message}
        </p>
      ) : null}
      {canArchive ? (
        <button type="button" className="secondary-button" onClick={onArchive} disabled={archiveState !== "idle"}>
          {archiveState === "saved" ? "아카이브 저장 완료 ✓" : archiveState === "saving" ? "저장 중..." : "아카이브에 저장"}
        </button>
      ) : null}
      <a
        className="primary-button"
        style={canArchive ? undefined : { gridColumn: "1 / -1" }}
        href={imageUrl ?? undefined}
        download={fileName}
        aria-disabled={!imageUrl}
      >
        이미지 저장
      </a>
      <p>아이폰에서는 이미지 공유에서 저장하거나, 다운로드한 파일을 사진 앱에 저장할 수 있어요.</p>
    </div>
  );
}
