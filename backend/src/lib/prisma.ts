// Khoi tao mot instance PrismaClient duy nhat (singleton) dung chung cho toan bo backend.
//
// Ly do can singleton: moi instance PrismaClient quan ly mot connection pool rieng.
// Neu tao moi PrismaClient o nhieu noi (vi du moi lan goi service), se rat de
// gay ra tinh trang "qua nhieu ket noi toi PostgreSQL" -> loi "too many clients".
//
// Trong moi truong dev voi tsx watch (hot-reload), module co the duoc nap lai
// nhieu lan -> ta luu instance vao "globalThis" de tai su dung lai giua cac lan reload.
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prismaClient ??
  new PrismaClient({
    // Bat log truy van trong moi truong development de de debug.
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaClient = prisma;
}
