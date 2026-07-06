-- AlterTable: Thêm isBlocked và role vào bảng users
ALTER TABLE "users" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'STUDENT';

-- CreateIndex: Index ho tro filter theo isBlocked va role trong admin panel.
CREATE INDEX "users_isBlocked_idx" ON "users"("isBlocked");
CREATE INDEX "users_role_idx" ON "users"("role");
