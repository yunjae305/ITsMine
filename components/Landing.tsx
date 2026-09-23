"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./ui";

const DEMO_ITEMS = [
  ["에그 베네딕트", 1, "14,000"],
  ["프렌치 토스트", 1, "10,000"],
  ["아메리카노", 2, "10,000"],
  ["카페라떼", 1, "5,000"],
] as const;

const STEPS = [
  { title: "영수증 등록", caption: "📷 영수증을 찰칵!" },
  { title: "몫 나누기", caption: "🧮 먹은 사람끼리 정확하게" },
  { title: "마음껏 꾸미기", caption: "🎀 사진·스티커로 우리답게" },
  { title: "정산 공유", caption: "💸 누가 누구에게 얼마인지" },
];

const FEATURES = [
  ["찍으면 메뉴가 쏙", "영수증 사진에서 메뉴와 금액을 읽어요."],
  ["먹은 사람끼리 정확하게", "메뉴마다 참여자를 선택해 정산해요."],
  ["우리 취향대로 자유롭게", "사진, 글씨, 스티커로 꾸며요."],
  ["정산 공유도 깔끔하게", "누가 누구에게 얼마인지 한눈에."],
];

export function Landing() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scanned, setScanned] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    setScanned(0);
    const timer = setInterval(() => setScanned((n) => (n >= DEMO_ITEMS.length ? n : n + 1)), 520);
    return () => clearInterval(timer);
  }, [step, playing]);

  return (
    <main className="landing-shell">
      <nav className="top-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">몫</span>몫대로
        </Link>
        <span className="nav-note">계산부터 추억까지</span>
      </nav>
      <div className="landing-grid">
        <section aria-label="몫대로 서비스 소개">
          <header className="hero-intro">
            <p className="eyebrow">계산부터 추억까지</p>
            <h1>
              나눌 땐 정확하게.
              <br />
              <em>남길 땐 우리답게.</em>
            </h1>
            <p className="description">
              먹은 만큼 나누고, 취향대로 꾸미고.
              <br />
              함께한 하루를 우리만의 정산표로 남겨요.
            </p>
            <div className="hero-tags">
              <span>메뉴별 정산</span>
              <span>가입 없는 초대</span>
              <span>사진 · 스티커 꾸미기</span>
            </div>
          </header>
          <div className={`hero-stage${playing ? "" : " paused"}`}>
            <div className="viewfinder" aria-label="영수증 촬영 후 메뉴를 자동으로 인식하는 시연">
              <span className="corner-b" aria-hidden="true" />
              <span className="scan-line" aria-hidden="true" />
              <article className="paper" aria-label="메뉴 4개가 적힌 종이 영수증 예시">
                <h3>영수증</h3>
                <p>2026.09.17 12:34</p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">품목</th>
                      <th scope="col">수량</th>
                      <th scope="col">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_ITEMS.map(([name, qty, price], i) => (
                      <tr key={name} className={step === 0 && i < scanned ? "hit" : ""}>
                        <td>{name}</td>
                        <td>{qty}</td>
                        <td>{price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="total">
                  <span>합계</span>
                  <span>39,000원</span>
                </div>
                <div className="barcode" aria-hidden="true" />
              </article>
            </div>
            <p className="capture-caption" aria-live="polite">
              {step === 0 && scanned >= DEMO_ITEMS.length ? "✓ 메뉴 4개 인식 완료" : STEPS[step].caption}
            </p>
            <div className="hero-steps" role="tablist" aria-label="서비스 소개 단계">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={i === step}
                  className={i === step ? "active" : ""}
                  onClick={() => setStep(i)}
                >
                  {String(i + 1).padStart(2, "0")} {s.title}
                </button>
              ))}
              <button
                type="button"
                aria-label={playing ? "애니메이션 일시 정지" : "애니메이션 재생"}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
            </div>
          </div>
          <div className="hero-features">
            {FEATURES.map(([title, body]) => (
              <div key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>
        <div className="mobile-cta">
          <button type="button" className="primary-button block" onClick={() => setAuthOpen((o) => !o)}>
            로그인하고 시작하기
          </button>
        </div>
        <AuthCard open={authOpen} />
      </div>
    </main>
  );
}

function AuthCard({ open }: { open: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await api(tab === "login" ? "/api/auth/login" : "/api/auth/signup", { body: data });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <aside className={`auth-card${open ? " open" : ""}`} aria-label="로그인 또는 회원가입">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "login"} className={tab === "login" ? "active" : ""} onClick={() => { setTab("login"); setError(""); }}>
          로그인
        </button>
        <button type="button" role="tab" aria-selected={tab === "signup"} className={tab === "signup" ? "active" : ""} onClick={() => { setTab("signup"); setError(""); }}>
          회원가입
        </button>
      </div>
      <h2>{tab === "login" ? "다시 만나 반가워요" : "몫대로 시작하기"}</h2>
      <p className="lead">모임장만 계정이 필요해요. 참여자는 링크로 들어올 수 있어요.</p>
      <form key={tab} onSubmit={submit}>
        {tab === "signup" ? (
          <label className="field">
            <span>이름</span>
            <input name="name" required maxLength={20} placeholder="홍길동" autoComplete="name" />
          </label>
        ) : null}
        <label className="field">
          <span>{tab === "login" ? "아이디 또는 이메일" : "이메일"}</span>
          <input
            name="email"
            type={tab === "login" ? "text" : "email"}
            required
            placeholder={tab === "login" ? "아이디 또는 이메일" : "you@example.com"}
            autoComplete={tab === "login" ? "username" : "email"}
          />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            name="password"
            type="password"
            required
            minLength={tab === "signup" ? 8 : undefined}
            placeholder={tab === "login" ? "비밀번호" : "8자 이상"}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "처리 중..." : tab === "login" ? "로그인" : "회원가입"}
        </button>
      </form>
    </aside>
  );
}
