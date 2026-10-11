#!/usr/bin/env bash
set -euo pipefail

if [ ! -S /var/run/docker.sock ]; then
  echo "Docker 소켓이 없습니다. 먼저: sudo service docker start" >&2
  exit 1
fi

sudo usermod -aG docker "${USER}" 2>/dev/null || true

if command -v setfacl >/dev/null 2>&1; then
  sudo setfacl -m "u:${USER}:rw" /var/run/docker.sock
else
  # 로컬 개발 VM용 폴백
  sudo chmod 666 /var/run/docker.sock
fi

docker info >/dev/null
echo "Docker 소켓 권한 설정 완료. 같은 터미널에서 docker compose를 다시 실행하세요."
