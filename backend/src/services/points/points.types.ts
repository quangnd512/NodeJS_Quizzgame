// Cac kieu du lieu (types) dung chung cho PointsService.
// Tach rieng ra de cac module khac (controller, test...) co the import ma
// khong phai phu thuoc vao toan bo logic cua service.

import type { Prisma } from '@prisma/client';

/** Du lieu tra ve khi truy van so du diem cua 1 user. */
export interface PointsBalance {
  userId: string;
  currentPoints: number;
  /** Phien ban hien tai cua ban ghi (phuc vu debug optimistic locking neu can). */
  version: number;
  /** Thoi diem cap nhat gan nhat. `null` neu user chua tung co giao dich (chua ton tai ban ghi DB). */
  lastUpdated: Date | null;
}

/** Mot ban ghi trong nhat ky giao dich diem. */
export interface PointTransactionRecord {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}

/** Ket qua phan trang cho lich su giao dich. */
export interface PaginatedHistory {
  items: PointTransactionRecord[];
  /** Tong so ban ghi hien co (dung de FE tinh tong so trang). */
  total: number;
  limit: number;
  offset: number;
}

/** Ket qua tra ve sau khi thuc hien chuyen diem giua 2 user. */
export interface TransferResult {
  fromUserId: string;
  toUserId: string;
  amount: number;
  fromBalanceAfter: number;
  toBalanceAfter: number;
}

/**
 * Danh sach ly do thay doi diem - dang "const object" thay vi enum
 * de tuong thich tot voi `verbatimModuleSyntax`/`isolatedModules` cua TS hien dai,
 * dong thoi van co duoc gia tri hang so + kieu du lieu chat che (literal union).
 *
 * Cac module nghiep vu khac (on tap, thi thu, PvP...) nen tai su dung cac
 * gia tri nay (hoac bo sung them) thay vi tu go chuoi tay -> tranh sai chinh ta
 * va de thong ke/bao cao theo "reason" sau nay.
 */
export const PointReason = {
  ON_TAP_CORRECT: 'ON_TAP_CORRECT', // Cong diem khi lam dung cau hoi o che do On tap
  THI_THU_ENTRY_FEE: 'THI_THU_ENTRY_FEE', // Tru 60 diem atomic khi vao thi thu
  THI_THU_RESULT: 'THI_THU_RESULT', // Cong/khong doi diem theo ket qua thi thu
  PVP_LOCK_BET: 'PVP_LOCK_BET', // Khoa diem cuoc khi tao/vao phong PvP
  PVP_WIN: 'PVP_WIN', // Nhan diem cuoc cua doi thu khi thang PvP
  PVP_LOSE: 'PVP_LOSE', // Mat diem cuoc khi thua PvP
  TRANSFER_OUT: 'TRANSFER_OUT', // Diem di chuyen ra (ben gui trong transferPoints)
  TRANSFER_IN: 'TRANSFER_IN', // Diem di chuyen vao (ben nhan trong transferPoints)
  REWARDED_VIDEO_BONUS: 'REWARDED_VIDEO_BONUS', // Thuong xem video quang cao
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT', // Admin dieu chinh thu cong (ho tro/khieu nai)
} as const;

export type PointReasonValue = (typeof PointReason)[keyof typeof PointReason];
