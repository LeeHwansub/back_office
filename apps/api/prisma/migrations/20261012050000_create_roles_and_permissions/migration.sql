-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SeedData: 기본 역할 (상위 → 하위: ROOT > MANAGER > ADMIN)
INSERT INTO "roles" ("id", "code", "name", "description") VALUES
    (gen_random_uuid(), 'ROOT', '최고 관리자', '시드로 만든 단일 계정. 모든 하위 역할의 계정과 권한을 관리한다.'),
    (gen_random_uuid(), 'MANAGER', '중간 관리자', '부여받은 권한 범위에서 하위 역할(ADMIN)의 계정과 권한을 관리한다.'),
    (gen_random_uuid(), 'ADMIN', '일반 관리자', '부여받은 권한 범위에서만 기능을 사용한다.');

-- SeedData: 기본 권한
INSERT INTO "permissions" ("id", "code", "name", "description") VALUES
    (gen_random_uuid(), 'USER_READ', '회원 목록 조회', '대시보드에서 회원 목록을 조회한다.'),
    (gen_random_uuid(), 'USER_CREATE', '회원 발급', '하위 역할의 새 계정을 발급한다.'),
    (gen_random_uuid(), 'USER_UPDATE', '회원 상태·역할 변경', '하위 역할 계정의 활성 상태와 역할을 변경한다.'),
    (gen_random_uuid(), 'ROLE_PERMISSION_UPDATE', '역할 권한 편집', '하위 역할에 부여된 권한을 편집한다.');

-- SeedData: ROOT·MANAGER는 모든 권한, ADMIN은 회원 목록 조회만
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p WHERE r."code" IN ('ROOT', 'MANAGER');

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" = 'USER_READ' WHERE r."code" = 'ADMIN';
