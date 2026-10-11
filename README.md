# back_office

사내 통합 관리자 포털 (Next.js + NestJS + PostgreSQL)

## 구조

```text
apps/web   Next.js 15 App Router
apps/api   NestJS 11 API
docker/    web / api / postgres Dockerfile·초기화 자리
```

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
- PostgreSQL: localhost:5432 (`postgres` / `postgres` / `back_office`)
