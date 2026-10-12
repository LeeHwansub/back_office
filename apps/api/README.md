# apps/api

통합 관리자 포털 인증 API (NestJS 11, Prisma 7, PostgreSQL)

실행 방법과 환경 변수는 [루트 README](../../README.md)를 참고하세요. 아래 명령은 모두 API 컨테이너 안에서 실행합니다(`docker compose exec api ...`).

## 폴더 구조

```text
src/
  app.setup.ts     전역 설정: /api/v1 접두사, CORS(WEB_URL, credentials 허용), 오류 필터, 입력 검증
  auth/            로그인, 세션 확인, 비밀번호 재설정 요청·확정 (컨트롤러, 서비스, DTO, 비밀번호 해시, 토큰, 세션 가드)
  mail/            비밀번호 재설정 메일 발송기 (Resend 또는 서버 로그)
  seed/            환경 변수 기반 시드 관리자 생성
  prisma/          PrismaService
  common/errors/   공통 오류 코드와 응답 형식
  generated/       Prisma Client 생성 결과 (커밋하지 않음)
prisma/
  schema.prisma    DB 스키마
  migrations/      마이그레이션
test/              e2e 테스트
```

`users`, `roles`, `dashboard`, `audit-logs`, `integrations`, `systems` 폴더는 이후 기능을 위한 자리이며 아직 비어 있습니다.

## API

모든 경로는 `/api/v1`로 시작하고, 요청 본문은 JSON입니다. 정의되지 않은 필드가 있거나 형식이 틀리면 400 `BAD_REQUEST`입니다.

### `POST /auth/login`

| 필드 | 규칙 |
|---|---|
| `loginId` | 필수, 50자 이하 |
| `password` | 필수, 200자 이하 |
| `rememberMe` | 선택, boolean |

- 성공: 204, 세션 쿠키 `sid` 발급
  - `httpOnly`, `SameSite=Lax`, `path=/`, `NODE_ENV=production`이면 `Secure`
  - `rememberMe`가 true면 7일 유지되는 쿠키, 아니면 브라우저를 닫으면 사라지는 쿠키(서버 세션은 8시간)
- 세션은 `admin_sessions`에 토큰의 SHA-256 해시로 저장합니다. 로그인 성공 시 `lastLoginAt`도 함께 갱신합니다.

| 상황 | 응답 |
|---|---|
| 없는 아이디, 틀린 비밀번호 | 401 `INVALID_CREDENTIALS` (두 경우를 구분하지 않음) |
| 비밀번호는 맞지만 잠긴 계정(LOCKED) | 403 `ACCOUNT_LOCKED` |
| 비밀번호는 맞지만 그 밖의 비활성 계정 | 403 `ACCOUNT_DISABLED` |

없는 아이디일 때도 가짜 해시 검증을 수행해 응답 시간으로 계정 존재 여부가 드러나지 않게 합니다.

### `GET /auth/me`

쿠키 `sid`의 세션으로 현재 로그인한 계정을 조회합니다. 다른 보호 API도 같은 세션 가드(`SessionGuard`)를 사용합니다.

- 성공: 200, `{ id, loginId, displayName, email, role: { code, name } | null, permissions: string[] }`
  - 비밀번호 해시는 포함하지 않습니다. `permissions`는 역할에 부여된 권한 코드를 정렬한 목록입니다.
- 쿠키가 없거나, 저장되지 않은 토큰이거나, 세션이 만료됐거나, 계정이 ACTIVE가 아니면 401 `UNAUTHORIZED`
  - 만료된 세션은 이때 삭제합니다.

### `POST /auth/logout`

- 항상 204. 쿠키 `sid`의 세션을 삭제하고 같은 속성으로 쿠키를 만료시킵니다.
- 쿠키가 없거나 이미 없는 세션이어도 204입니다. 같은 계정의 다른 세션(다른 기기)은 유지합니다.

### `POST /auth/password-reset`

| 필드 | 규칙 |
|---|---|
| `loginId` | 필수, 50자 이하 |
| `email` | 필수, 이메일 형식, 255자 이하 |

- 형식이 맞으면 계정 존재 여부와 관계없이 항상 204입니다.
- 아이디가 있고 이메일이 일치하며(대소문자 무시) 상태가 ACTIVE 또는 LOCKED일 때만:
  1. 그 계정의 사용하지 않은 이전 재설정 토큰을 지웁니다.
  2. 30분 동안 유효한 토큰을 만듭니다(DB에는 해시만 저장).
  3. `{WEB_URL}/reset-password?token=...` 링크를 메일로 보냅니다. 응답을 기다리게 하지 않도록 백그라운드로 보내고, 실패하면 토큰 없이 로그만 남깁니다.

### `POST /auth/password-reset/confirm`

| 필드 | 규칙 |
|---|---|
| `token` | 필수, 100자 이하 |
| `newPassword` | 8~200자, 영문과 숫자를 각각 1자 이상 포함 |

- 성공: 204. 하나의 트랜잭션에서 다음을 처리합니다.
  - 토큰을 사용 처리합니다. 동시 요청이 와도 한 번만 성공합니다.
  - 새 비밀번호 해시를 저장하고 계정 상태를 ACTIVE로 바꿉니다(잠금 해제).
  - 그 계정의 다른 미사용 토큰과 모든 로그인 세션을 지웁니다.
- 없는 토큰, 만료·사용된 토큰, 재설정할 수 없는 상태의 계정: 400 `INVALID_RESET_TOKEN`

## 오류 응답

오류 응답 본문은 `{ "code": "<오류 코드>" }` 하나만 담습니다. 내부 오류 내용은 클라이언트에 보내지 않습니다.

| 코드 | HTTP 상태 |
|---|---|
| `BAD_REQUEST`, `INVALID_RESET_TOKEN` | 400 |
| `UNAUTHORIZED`, `INVALID_CREDENTIALS` | 401 |
| `FORBIDDEN`, `ACCOUNT_DISABLED`, `ACCOUNT_LOCKED` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `UNPROCESSABLE` | 422 |
| `TOO_MANY_REQUESTS` | 429 |
| `SERVER_ERROR` | 500 |

## DB

| 테이블 | 내용 |
|---|---|
| `admin_users` | 관리자 계정. 아이디(`username`)·이메일 고유, 비밀번호 해시(argon2), 상태 ACTIVE / INACTIVE / LOCKED |
| `admin_sessions` | 로그인 세션. 토큰 해시, 만료 시각 |
| `password_reset_tokens` | 비밀번호 재설정 토큰. 토큰 해시, 만료 시각, 사용 시각 |

세션과 재설정 토큰은 계정이 삭제되면 함께 삭제됩니다.

```bash
npm run prisma:generate            # Prisma Client 생성
npx prisma migrate deploy          # 마이그레이션 적용 (컨테이너 시작 시 자동 실행)
```

새 마이그레이션은 이전 스키마와 비교해 SQL을 만든 뒤 `prisma/migrations/<타임스탬프>_<이름>/migration.sql`로 추가합니다.

```bash
npx prisma migrate diff --from-schema <이전 schema.prisma> --to-schema prisma/schema.prisma --script
```

## 테스트

```bash
npm test                                      # 단위 테스트
npm run test:e2e                              # e2e 테스트
npx tsc --noEmit -p tsconfig.json             # 타입 검사
npx eslint "{src,test}/**/*.ts" prisma.config.ts
npx nest build
```

- e2e 테스트는 `TEST_DATABASE_URL`(`back_office_test`)을 사용합니다. 시작할 때 마이그레이션을 적용하고, 테스트마다 모든 테이블을 비웁니다.
- 테스트 DB를 함께 쓰므로 e2e 테스트는 순서대로 하나씩 실행합니다(`maxWorkers: 1`).
