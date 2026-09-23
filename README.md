# 몫대로 (ITsMine)

먹은 메뉴만큼 정확하게 나누는 더치페이. 영수증의 메뉴마다 먹은 사람을 골라 정산하고, 결과를 꾸민 정산표 이미지로 남깁니다.

화면·기능 명세는 [docs/SPEC.md](docs/SPEC.md)에 있습니다.

## 주요 기능

- **계정**: 이메일 회원가입/로그인(아이디 또는 이메일), 닉네임 수정, 알림
- **새 정산**: 혼자 정리하기(참여자 이름 직접 입력) / 함께 정리하기(1인 1링크 초대, 가입 없이 닉네임으로 참여)
- **영수증**: 메뉴별 수량·단가·먹은 사람 입력, 사진 인식(Claude 비전), 수정·삭제
- **정산**: 멤버별 결제/내 몫/받기·보내기, 최소 송금 안내, 정산 완료(잠금)
- **정산표 꾸미기**: 템플릿 9종, 글꼴 5종, 내 사진 배경, 이모지·문구 스티커(드래그·크기·회전, 키보드 조작), 이미지 저장, 아카이브 저장
- **대시보드**: 지금 내 돈 흐름(받을 돈/보낼 돈 상세), 전체/진행 중/지난 정산 목록

## 기술 스택

- Next.js 16 (App Router) + React 19 + TypeScript
- Drizzle ORM + PostgreSQL (`DATABASE_URL`), 없으면 내장 PGlite(`.data/pglite`)
- 영수증 인식: Anthropic SDK (`ANTHROPIC_API_KEY`)

## 실행

```bash
npm install
cp .env.example .env.local   # 필요하면 DATABASE_URL, ANTHROPIC_API_KEY 입력
npm run dev                  # http://localhost:3000
```

테이블은 서버가 처음 DB에 연결할 때 자동으로 만들어집니다.

```bash
npm test          # 정산 계산 단위 테스트
npm run typecheck
npm run build
```

## Supabase 연결

Supabase 프로젝트 `itsmine`(ref `oxeigksibzuuuiulnkaz`, 서울 리전)에 테이블이 이미 만들어져 있습니다.
모든 테이블에 RLS 를 켜고 정책은 두지 않아 anon/publishable 키로는 읽고 쓸 수 없습니다.
앱은 서버에서 DB 계정으로 직접 접속하므로 영향이 없습니다.

1. Supabase 대시보드 → 프로젝트 `itsmine` → **Connect** → **Transaction pooler** 연결 문자열을 복사합니다.
   (바로가기: https://supabase.com/dashboard/project/oxeigksibzuuuiulnkaz?showConnect=true&method=transaction ,
   비밀번호를 모르면 Connect 창의 Reset database password)
2. `.env.local` 또는 Vercel 환경 변수에 `DATABASE_URL`로 넣습니다.

```
DATABASE_URL=postgresql://postgres.oxeigksibzuuuiulnkaz:<비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

서버가 시작할 때 `lib/db/schema.ts`의 `BOOTSTRAP_SQL`을 다시 실행하지만 모두 `if not exists`라 안전합니다.

## 배포 메모

- Vercel 등 서버리스 환경에서는 PGlite 파일 저장이 유지되지 않으므로 `DATABASE_URL`(Supabase/Neon 등 Postgres)을 꼭 설정하세요.
- `ANTHROPIC_API_KEY`가 없으면 "사진 선택" 탭에서 안내 문구가 나오고 직접 입력만 쓸 수 있습니다.
