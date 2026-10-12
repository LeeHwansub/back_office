# back_office

사내 통합 관리자 포털 인증 시스템 (Next.js + NestJS + PostgreSQL)

공개 회원가입 없이 발급된 관리자 계정으로 로그인하고, 비밀번호를 잊었을 때 이메일 링크로 재설정합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Web | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, axios |
| API | NestJS 11, Prisma 7, class-validator, argon2(비밀번호 해시), Resend(메일 발송) |
| DB | PostgreSQL 17 |
| 테스트 | Web: Vitest + Testing Library, API: Jest(단위·e2e) |
| 실행 환경 | Docker Compose, Node.js 22 |

## 구조

```text
apps/web      Next.js 웹 (로그인·비밀번호 찾기·비밀번호 재설정 화면)
apps/api      NestJS API (/api/v1)
docker/       web / api Dockerfile, postgres 초기화 SQL(테스트 DB 생성)
scripts/      개발 환경 보조 스크립트
```

앱별 상세 설명은 [apps/web/README.md](apps/web/README.md), [apps/api/README.md](apps/api/README.md)를 참고하세요.

## 실행 (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

`permission denied ... docker.sock` 오류가 나면 현재 셸에 `docker` 그룹이 아직 반영되지 않은 상태입니다. 아래 중 하나를 실행한 뒤 다시 시도하세요.

```bash
# 권장: 소켓 ACL 부여 (즉시 반영)
./scripts/fix-docker-socket.sh

# 또는 새 그룹 세션
newgrp docker
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- PostgreSQL: localhost:5432 (`postgres` / `postgres` / `back_office`, 테스트 DB `back_office_test`)

API 컨테이너는 시작할 때 Prisma Client 생성, 마이그레이션 적용, 시드 관리자 생성을 차례로 실행합니다.

`.env` 값을 바꾼 뒤에는 컨테이너를 다시 만들어야 반영됩니다.

```bash
docker compose up -d api
```

## 환경 변수

`.env.example`을 복사해 `.env`를 만듭니다. `.env`는 커밋하지 않습니다.

| 이름 | 용도 |
|---|---|
| `NEXT_PUBLIC_API_URL` | 웹이 호출할 API 주소 |
| `PORT` | API 포트 |
| `WEB_URL` | CORS 허용 출처, 재설정 메일 링크의 웹 주소 |
| `DATABASE_URL`, `TEST_DATABASE_URL` | 개발 DB, e2e 테스트 DB 연결 주소 |
| `SEED_ADMIN_LOGIN_ID`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_DISPLAY_NAME` | 시드 관리자 계정 |
| `RESEND_API_KEY`, `MAIL_FROM` | 비밀번호 재설정 메일 발송 |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL 컨테이너 초기 설정 |

**시드 관리자**

- `SEED_ADMIN_*`을 모두 비우면 시드를 건너뜁니다. 일부만 채우면 API 시작이 중단됩니다.
- 같은 아이디나 이메일의 계정이 이미 있으면 건너뜁니다.
- 아이디 최대 50자, 이메일 형식, 비밀번호 8~200자, 표시 이름을 비우면 '관리자'입니다.

**비밀번호 재설정 메일**

- `RESEND_API_KEY`가 없으면 메일 대신 재설정 링크를 API 서버 로그에 남깁니다(개발용). API 시작 시 경고를 출력합니다.
- `MAIL_FROM`을 비우면 `onboarding@resend.dev`로 보냅니다. 이 주소는 Resend 가입 계정 주소로만 발송할 수 있습니다. 다른 주소로 보내려면 Resend에서 도메인을 인증해야 합니다.

## 구현된 기능

| 화면 | 경로 | 호출 API |
|---|---|---|
| 로그인 | `/login` | `POST /api/v1/auth/login` |
| 비밀번호 찾기 | `/forgot-password` | `POST /api/v1/auth/password-reset` |
| 비밀번호 재설정 | `/reset-password?token=...` | `POST /api/v1/auth/password-reset/confirm` |

- 로그인에 성공하면 세션 쿠키 `sid`를 발급하고 `/dashboard`로 이동합니다.
- API 요청·응답 규칙과 오류 코드는 [apps/api/README.md](apps/api/README.md)에 정리했습니다.

## 테스트와 검증

```bash
# Web (로컬 apps/web에서)
cd apps/web
npm test          # Vitest
npm run lint
npx tsc --noEmit
npm run build

# API (컨테이너 안에서)
docker compose exec api npm test           # 단위 테스트
docker compose exec api npm run test:e2e   # e2e 테스트 (back_office_test DB 사용)
docker compose exec api npx tsc --noEmit -p tsconfig.json
docker compose exec api npx nest build
```

## 아직 구현하지 않은 것

- 로그아웃, 세션 확인(`GET /auth/me`) API와 보호 페이지 접근 제어
- 관리자 화면(`/dashboard`, `/users`, `/roles` 등): 폴더만 있고 화면은 없습니다. 지금은 로그인 후 `/dashboard`가 404입니다.
- 요청 횟수 제한(rate limit), 만료된 세션·재설정 토큰 정리, 감사 로그

## 개발 규칙

- Git Flow: `feature/*`, `fix/*`는 `dev`에서 분기해 `dev`로 PR을 보냅니다. `main`, `dev`에 직접 커밋하지 않습니다.
- 커밋 메시지와 PR은 한글로 작성합니다.
- 기능은 테스트를 먼저 작성하고(Red) 구현합니다(Green).
