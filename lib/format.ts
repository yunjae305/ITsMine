/** 서버와 브라우저에서 같은 글자가 나오도록 한국 시간으로 고정해 날짜를 표시한다. */
const TIME_ZONE = "Asia/Seoul";

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TIME_ZONE }).format(new Date(iso));
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TIME_ZONE, dateStyle: "long" }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
