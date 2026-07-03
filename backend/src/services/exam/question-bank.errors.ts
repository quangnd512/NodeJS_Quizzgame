// Cac loai loi cho Ngan hang cau hoi (Question Bank).
// Theo cung pattern voi exam.errors.ts: lop co so co truong `code`.

/** Lop loi co so cho Ngan hang cau hoi. */
export class QuestionBankError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Khong tim thay cau hoi trong kho theo ID. */
export class QuestionBankNotFoundError extends QuestionBankError {
  constructor(id: string) {
    super(`Khong tim thay cau hoi trong kho '${id}'.`, 'QUESTION_BANK_NOT_FOUND');
  }
}

/**
 * Khong the xoa cau hoi vi con ExamSession dang IN_PROGRESS tham chieu den no.
 * Admin can cho cac phien thi thu ket thuc truoc khi xoa.
 */
export class QuestionBankDeleteBlockedError extends QuestionBankError {
  constructor(id: string) {
    super(
      `Khong the xoa cau hoi '${id}' vi con phien thi thu dang dien ra co su dung cau hoi nay. Vui long cho ket thuc phien truoc khi xoa.`,
      'QUESTION_BANK_DELETE_BLOCKED',
    );
  }
}

/** Trung lap khi them cau tu kho vao de thi (cau da ton tai trong de). */
export class QuestionBankDuplicateError extends QuestionBankError {
  constructor() {
    super('Mot so cau hoi da ton tai trong de thi nay (se bi bo qua).', 'QUESTION_BANK_DUPLICATE');
  }
}
