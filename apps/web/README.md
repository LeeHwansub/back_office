# apps/web

통합 관리자 포털 웹 (Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4)

실행 방법과 환경 변수는 [루트 README](../../README.md)를 참고하세요. Docker Compose로 실행하면 `http://localhost:3000`에서 열립니다.

## 폴더 구조

```text
src/
  app/
    (auth)/            로그인 전 화면과 공통 레이아웃
      login/           /login
      forgot-password/ /forgot-password
      reset-password/  /reset-password?token=...
    (admin)/           관리자 화면 자리 (아직 비어 있음)
  features/auth/       인증 화면의 폼, API 호출 함수, 화면별 오류 문구 매핑
  lib/
    http-client.ts     axios 공통 클라이언트와 HttpError
    error-messages.ts  화면에 표시하는 오류·안내 문구 목록
    http-error-messages.ts  HTTP 상태 코드별 공통 문구
  components/          공통 레이아웃·UI 자리 (아직 비어 있음)
```

## 화면

| 경로 | 동작 |
|---|---|
| `/` | 접속하면 `/login`으로 이동 |
| `/login` | 아이디·비밀번호 필수 입력 검사, 로그인 상태 유지 선택. 성공하면 `/dashboard`로 이동 |
| `/forgot-password` | 아이디·이메일 필수 입력과 이메일 형식 검사. 요청이 성공하면 계정 존재 여부와 관계없이 같은 발송 안내 표시 |
| `/reset-password` | 주소의 `token`이 없거나 비어 있거나 여러 개면 올바르지 않은 링크 안내. 새 비밀번호 규칙(영문·숫자 포함 8~200자)과 확인 일치 검사. 성공하면 `/login`으로 이동, 링크가 만료·사용됐으면 다시 요청하기 링크 표시 |

- 모든 폼은 요청 중 버튼을 비활성화해 중복 제출을 막고, 실패하면 입력값을 유지합니다.
- 오류 안내는 입력란과 버튼 사이에 표시하고, 서버 오류 내용이나 입력한 비밀번호는 화면에 보여 주지 않습니다.

## API 호출

모든 API 호출은 `src/lib/http-client.ts`의 `httpClient`를 사용합니다.

- 기본 주소: `NEXT_PUBLIC_API_URL` (없으면 같은 출처)
- JSON 요청, 모든 요청에 쿠키 포함(`withCredentials`), 시간 제한 10초
- 실패는 모두 `HttpError(status, code)`로 바뀝니다.
  - 오류 응답: HTTP 상태 코드와 응답 본문의 `code`
  - 네트워크 오류·시간 초과: `status`, `code` 모두 null

화면별 API 함수(`features/auth/api.ts`)는 `HttpError`를 화면용 오류(`LoginError`, `PasswordResetError`, `PasswordResetConfirmError`)로 바꾸고, 각 오류는 화면에 표시할 문구를 `message`로 가집니다.

## 테스트

```bash
npm test          # Vitest (jsdom, Testing Library)
npm run lint
npx tsc --noEmit
npm run build
```

- API 호출 테스트는 `axios-mock-adapter`로 `httpClient`의 응답을 가짜로 만듭니다.
- 폼 테스트는 `./api` 모듈과 `next/navigation`의 `useRouter`를 모킹합니다.

## 아직 구현하지 않은 것

- 관리자 화면과 로그인 여부에 따른 페이지 접근 제어가 없습니다.
- 잠긴 계정(403 `ACCOUNT_LOCKED`)도 비활성 계정과 같은 문구로 안내합니다.
