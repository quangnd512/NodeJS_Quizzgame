-- AlterTable: Thêm isBlocked và role vào bảng users
ALTER TABLE "users" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'STUDENT';
