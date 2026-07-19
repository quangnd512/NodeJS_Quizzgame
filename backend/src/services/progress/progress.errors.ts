// Cac loai loi (custom error classes) rieng cho module Tien do hoc tap (Progress).

export class ProgressError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Nem ra khi user Free co goi GET /api/progress/exam-history — tinh nang
 * "Lich su thi thu" chi danh cho Premium (chan han o BACKEND, khong tra ve
 * du lieu ke ca rong, khong chi an o UI).
 */
export class ExamHistoryPremiumOnlyError extends ProgressError {
  constructor() {
    super('Tinh nang "Lich su thi thu" chi danh cho tai khoan Premium.', 'EXAM_HISTORY_PREMIUM_ONLY');
  }
}
