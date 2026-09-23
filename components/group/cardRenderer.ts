import type { GroupBoard } from "@/lib/groups";
import { formatDate } from "@/lib/format";
import { formatWon } from "@/lib/settlement";

export const CARD_WIDTH = 540;
export const ART_HEIGHT = 300;
export const PIXEL_RATIO = 2;

export type FontId = "default" | "jua" | "gaegu" | "gamja" | "gungsuh";

export const FONTS: { id: FontId; label: string; family: string | null }[] = [
  { id: "default", label: "기본", family: null },
  { id: "jua", label: "주아체 · 동글동글", family: "Jua" },
  { id: "gaegu", label: "개구체 · 손글씨", family: "Gaegu" },
  { id: "gamja", label: "감자꽃체 · 귀여운 필기", family: "Gamja Flower" },
  { id: "gungsuh", label: "궁서체 · 진지하게", family: "Song Myung" },
];

export const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Gamja+Flower&family=Jua&family=Song+Myung&display=swap";

export type Theme = {
  id: string;
  label: string;
  icon: string;
  background: string;
  accent: string;
  emojis: [string, string];
  mono?: boolean;
};

export const THEMES: Theme[] = [
  { id: "brunch", label: "브런치", icon: "🥐", background: "#fdf0df", accent: "#d9772b", emojis: ["🥐", "☕️"] },
  { id: "travel", label: "여행", icon: "✈️", background: "#e3f1fd", accent: "#2f7fd6", emojis: ["✈️", "🏝️"] },
  { id: "party", label: "파티", icon: "🎉", background: "#efeafd", accent: "#7c5ce0", emojis: ["🎉", "💖"] },
  { id: "lavender", label: "라벤더", icon: "🪻", background: "#ece9fb", accent: "#6c5bd6", emojis: ["🪻", "✨"] },
  { id: "peach", label: "피치 다이어리", icon: "🎀", background: "#fde7e4", accent: "#e0604f", emojis: ["🎀", "🍑"] },
  { id: "cream", label: "크림 영수증", icon: "🌼", background: "#f5ecd9", accent: "#9b7437", emojis: ["🌼", "🤎"] },
  { id: "butter", label: "버터 옐로", icon: "🧈", background: "#fbf1b8", accent: "#3f63d6", emojis: ["🧈", "✨"], mono: true },
  { id: "ticket", label: "흑백 티켓", icon: "🎟️", background: "#eceef2", accent: "#232638", emojis: ["🎟️", "🖤"], mono: true },
  { id: "cherry", label: "체리 레드", icon: "🍒", background: "#fde7ea", accent: "#d6283f", emojis: ["🍒", "♥️"] },
];

export const EMOJI_CHOICES = ["🥐", "☕️", "🍰", "🍻", "✈️", "🏝️", "🎉", "💖", "✨", "🫶", "🐱", "😎"];
export const MAX_LAYERS = 12;

export type Layer = {
  id: string;
  kind: "emoji" | "text";
  text: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
};

export type Design = {
  font: FontId;
  mode: "template" | "photo";
  themeId: string;
  photo: HTMLImageElement | null;
  /** 사진 세로 위치 0~1 */
  photoPosition: number;
  layers: Layer[];
};

const INK = "#232638";
const MUTED = "#7b8196";
const LINE = "#e6e8ef";
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const SANS = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif';
const MONO = '"Courier New", "Apple SD Gothic Neo", monospace';

let layerSeq = 0;
export function newLayerId() {
  layerSeq += 1;
  return `layer-${Date.now().toString(36)}-${layerSeq}`;
}

export function defaultLayers(theme: Theme, title: string): Layer[] {
  return [
    { id: newLayerId(), kind: "text", text: title, x: CARD_WIDTH / 2, y: 78, size: 26, rotation: 0, color: INK },
    { id: newLayerId(), kind: "emoji", text: theme.emojis[0], x: CARD_WIDTH / 2 - 72, y: 192, size: 76, rotation: 0, color: INK },
    { id: newLayerId(), kind: "emoji", text: theme.emojis[1], x: CARD_WIDTH / 2 + 72, y: 192, size: 76, rotation: 0, color: INK },
  ];
}

export function themeById(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function fontFamily(font: FontId) {
  const family = FONTS.find((f) => f.id === font)?.family;
  return family ? `"${family}", ${SANS}` : SANS;
}

function layerFont(layer: Layer, font: FontId) {
  return layer.kind === "emoji" ? `${layer.size}px ${EMOJI_FONT}` : `700 ${layer.size}px ${fontFamily(font)}`;
}

/** 레이어의 회전 전 너비·높이(카드 좌표). */
export function layerBox(ctx: CanvasRenderingContext2D, layer: Layer, font: FontId) {
  ctx.save();
  ctx.font = layerFont(layer, font);
  const width = layer.kind === "emoji" ? layer.size * 1.15 : Math.max(ctx.measureText(layer.text).width, layer.size) + 16;
  ctx.restore();
  return { width, height: layer.size * 1.3 };
}

export function hitTest(ctx: CanvasRenderingContext2D, layers: Layer[], font: FontId, x: number, y: number) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const { width, height } = layerBox(ctx, layer, font);
    const dx = x - layer.x;
    const dy = y - layer.y;
    const cos = Math.cos(-layer.rotation);
    const sin = Math.sin(-layer.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= width / 2 && Math.abs(ly) <= height / 2) return layer;
  }
  return null;
}

type Row = { draw: (ctx: CanvasRenderingContext2D, y: number) => void; height: number };

function buildBody(board: GroupBoard, theme: Theme, font: FontId): Row[] {
  const family = fontFamily(font);
  const numberFamily = theme.mono && font === "default" ? MONO : family;
  const name = new Map(board.members.map((m) => [m.id, m.nickname]));
  const total = board.receipts.reduce((s, r) => s + r.total, 0);
  const left = 34;
  const right = CARD_WIDTH - 34;
  const rows: Row[] = [];
  const text = (
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    style: { size: number; weight?: number; color?: string; align?: CanvasTextAlign; family?: string },
  ) => {
    ctx.font = `${style.weight ?? 400} ${style.size}px ${style.family ?? family}`;
    ctx.fillStyle = style.color ?? INK;
    ctx.textAlign = style.align ?? "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(value, x, y);
  };
  const line = (ctx: CanvasRenderingContext2D, y: number) => {
    ctx.fillStyle = LINE;
    ctx.fillRect(left, y, right - left, 1);
  };

  rows.push({ height: 58, draw: (ctx, y) => text(ctx, "우리 모임 정산표", left, y + 44, { size: 18, weight: 800 }) });
  rows.push({ height: 26, draw: (ctx, y) => text(ctx, "총 사용 금액", left, y + 18, { size: 12, color: MUTED }) });
  rows.push({
    height: 50,
    draw: (ctx, y) => text(ctx, formatWon(total), left, y + 38, { size: 32, weight: 800, family: numberFamily }),
  });
  rows.push({ height: 32, draw: (ctx, y) => text(ctx, "각자의 몫", left, y + 22, { size: 12, color: MUTED }) });
  for (const b of board.balances) {
    rows.push({
      height: 40,
      draw: (ctx, y) => {
        line(ctx, y);
        text(ctx, name.get(b.memberId) ?? "참여자", left, y + 26, { size: 15 });
        text(ctx, formatWon(b.owes), right, y + 26, { size: 15, weight: 800, align: "right", family: numberFamily });
      },
    });
  }
  rows.push({ height: 54, draw: (ctx, y) => text(ctx, "보낼 금액 안내", left, y + 42, { size: 15, weight: 800 }) });
  if (board.transfers.length) {
    for (const t of board.transfers) {
      rows.push({
        height: 36,
        draw: (ctx, y) => {
          text(ctx, `${name.get(t.fromMemberId)} → ${name.get(t.toMemberId)}`, left, y + 22, { size: 14, weight: 600 });
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = LINE;
          ctx.beginPath();
          ctx.moveTo(left, y + 32);
          ctx.lineTo(right, y + 32);
          ctx.stroke();
          ctx.setLineDash([]);
          text(ctx, formatWon(t.amount), right, y + 22, { size: 14, weight: 800, align: "right", color: theme.accent, family: numberFamily });
        },
      });
    }
  } else {
    rows.push({ height: 32, draw: (ctx, y) => text(ctx, "서로 주고받을 금액이 없어요", left, y + 22, { size: 13, color: MUTED }) });
  }
  rows.push({ height: 56, draw: (ctx, y) => text(ctx, "영수증 내역", left, y + 42, { size: 15, weight: 800 }) });
  for (const r of board.receipts) {
    rows.push({
      height: 48,
      draw: (ctx, y) => {
        line(ctx, y + 4);
        text(ctx, r.storeName, left, y + 28, { size: 14, weight: 800 });
        text(ctx, formatWon(r.total), right, y + 28, { size: 14, weight: 800, align: "right", family: numberFamily });
        text(ctx, `${name.get(r.paidByMemberId) ?? "참여자"}님이 결제`, left, y + 44, { size: 11, color: MUTED });
      },
    });
    for (const item of r.items) {
      rows.push({
        height: 36,
        draw: (ctx, y) => {
          text(ctx, `${item.menu_name} × ${item.quantity}`, left + 10, y + 16, { size: 12 });
          text(ctx, formatWon(item.quantity * item.unit_price), right, y + 16, { size: 12, align: "right", family: numberFamily });
          const eaters = item.consumer_member_ids.map((id) => name.get(id) ?? "참여자").join(", ");
          text(ctx, eaters, left + 10, y + 31, { size: 11, color: MUTED });
        },
      });
    }
  }
  rows.push({
    height: 70,
    draw: (ctx, y) => {
      line(ctx, y + 18);
      text(ctx, "몫대로 · 먹은 만큼 정확하게", CARD_WIDTH / 2, y + 48, { size: 11, color: MUTED, align: "center", family: SANS });
    },
  });
  return rows;
}

export function cardHeight(board: GroupBoard, design: Design) {
  const rows = buildBody(board, themeById(design.themeId), design.font);
  return ART_HEIGHT + rows.reduce((s, r) => s + r.height, 0);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawCard(
  canvas: HTMLCanvasElement,
  board: GroupBoard,
  design: Design,
) {
  const theme = themeById(design.themeId);
  const rows = buildBody(board, theme, design.font);
  const height = ART_HEIGHT + rows.reduce((s, r) => s + r.height, 0);
  if (canvas.width !== CARD_WIDTH * PIXEL_RATIO) canvas.width = CARD_WIDTH * PIXEL_RATIO;
  if (canvas.height !== Math.round(height * PIXEL_RATIO)) canvas.height = Math.round(height * PIXEL_RATIO);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.clearRect(0, 0, CARD_WIDTH, height);

  // 배경
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, CARD_WIDTH, height);
  const photo = design.mode === "photo" ? design.photo : null;
  if (photo) {
    const scale = Math.max(CARD_WIDTH / photo.naturalWidth, height / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    ctx.drawImage(photo, (CARD_WIDTH - w) / 2, (height - h) * design.photoPosition, w, h);
    // 본문은 반투명 흰 판 위에 그려 금액이 잘 보이게 한다.
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(ctx, 14, ART_HEIGHT, CARD_WIDTH - 28, height - ART_HEIGHT - 14, 18);
    ctx.fill();
  } else {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CARD_WIDTH, ART_HEIGHT);
  }

  // 머리글
  ctx.fillStyle = "#5366ec";
  roundRect(ctx, 22, 20, 22, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 12px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("몫", 33, 31.5);
  const date = formatDate(board.completedAt ?? board.createdAt);
  ctx.font = `500 12px ${fontFamily(design.font)}`;
  ctx.textAlign = "left";
  ctx.fillStyle = photo ? "rgba(255,255,255,0.95)" : MUTED;
  if (photo) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 4;
  }
  ctx.fillText(`${date} · ${board.members.length}명`, 52, 31.5);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // 본문
  let y = ART_HEIGHT;
  for (const row of rows) {
    row.draw(ctx, y);
    y += row.height;
  }

  // 스티커 레이어
  for (const layer of design.layers) {
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate(layer.rotation);
    ctx.font = layerFont(layer, design.font);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = layer.color;
    if (layer.kind === "text" && photo) {
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 6;
    }
    ctx.fillText(layer.text, 0, layer.kind === "emoji" ? layer.size * 0.05 : 0);
    ctx.restore();
  }
  return height;
}
