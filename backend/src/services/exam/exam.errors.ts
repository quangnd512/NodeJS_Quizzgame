// Cac loai loi (custom error classes) cho module Thi thu (Exam).
// Theo cung pattern voi practice.errors.ts / points.errors.ts:
//   - Lop co so ExamError chua truong `code` de ERROR_CODE_TO_HTTP_STATUS anh xa.
//   - Moi lop con mo ta chinh xac 1 tinh huong loi cu the.

import { EXAM_ENTRY_FEE } from './exam.types.js';

/** Lop loi co so cho moi loi lien quan den module Thi thu. */
export class ExamError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Khong tim thay de thi theo ID. */
export class ExamPaperNotFoundError extends ExamError {
  constructor(examPaperId: string) {
    super(`Khong tim thay de thi '${examPaperId}'.`, 'EXAM_PAPER_NOT_FOUND');
  }
}

/** Khong tim thay cau hoi thi thu theo ID. */
export class ExamQuestionNotFoundError extends ExamError {
  constructor(questionId: string) {
    super(`Khong tim thay cau hoi '${questionId}'.`, 'EXAM_QUESTION_NOT_FOUND');
  }
}

/** Ma mon hoc khong hop le (khong nam trong SUBJECT_CATALOG). */
export class ExamInvalidSubjectError extends ExamError {
  constructor(subjectId: string) {
    super(`Ma mon hoc '${subjectId}' khong hop le.`, 'EXAM_INVALID_SUBJECT');
  }
}

/** Mon hoc chua co de thi thu nao hop le (dang kich hoat va co it nhat 1 cau hoi). */
export class ExamPaperEmptyError extends ExamError {
  constructor(subjectId: string) {
    super('Chua co de thi thu cho mon nay.', 'EXAM_PAPER_EMPTY');
    this.subjectId = subjectId;
  }

  public readonly subjectId: string;
}

/** User khong du diem toi thieu de vao thi thu (xem EXAM_ENTRY_FEE). */
export class ExamInsufficientPointsError extends ExamError {
  constructor() {
    super(
      `Ban can it nhat ${EXAM_ENTRY_FEE} diem tich luy de vao thi thu.`,
      'EXAM_INSUFFICIENT_POINTS',
    );
  }
}

/** Khong tim thay phien thi thu theo ID. */
export class ExamSessionNotFoundError extends ExamError {
  constructor(sessionId: string) {
    super(`Khong tim thay phien thi thu '${sessionId}'.`, 'EXAM_SESSION_NOT_FOUND');
  }
}

/** Phien thi thu khong thuoc ve user dang dang nhap. */
export class ExamSessionNotOwnedError extends ExamError {
  constructor(sessionId: string) {
    super(`Phien thi thu '${sessionId}' khong thuoc ve ban.`, 'EXAM_SESSION_NOT_OWNED');
  }
}

/** Phien thi thu da duoc nop bai (cham diem) truoc do - khong the nop lai. */
export class ExamSessionAlreadyCompletedError extends ExamError {
  constructor(sessionId: string) {
    super(
      `Phien thi thu '${sessionId}' da duoc nop bai truoc do.`,
      'EXAM_SESSION_ALREADY_COMPLETED',
    );
  }
}

/** Phien thi thu chua nop bai - chua co ket qua de xem. */
export class ExamSessionNotCompletedError extends ExamError {
  constructor(sessionId: string) {
    super(`Phien thi thu '${sessionId}' chua nop bai - chua co ket qua.`, 'EXAM_SESSION_NOT_COMPLETED');
  }
}

/**
 * Phien thi thu da qua thoi gian lam bai (+ EXAM_GRACE_SECONDS) tai thoi diem nop bai.
 * Bai se KHONG duoc cham diem va KHONG hoan lai so diem da tru khi vao thi.
 */
export class ExamExpiredError extends ExamError {
  constructor(sessionId: string) {
    super(
      `Phien thi thu '${sessionId}' da het thoi gian lam bai - bai khong duoc cham diem.`,
      'EXAM_EXPIRED',
    );
  }
}

/**
 * User nop bai khi chua du thoi gian lam bai toi thieu (EXAM_MIN_SUBMIT_RATIO * durationMinutes).
 * HTTP 400. `remainingSeconds` la so giay con thieu.
 * Frontend hien: "Ban can lam them it nhat X phut nua moi duoc nop."
 */
export class ExamSubmitTooEarlyError extends ExamError {
  constructor(remainingSeconds: number) {
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    super(
      `Ban can lam bai them it nhat ${remainingMinutes} phut nua moi duoc nop.`,
      'EXAM_SUBMIT_TOO_EARLY',
    );
    this.remainingSeconds = remainingSeconds;
  }

  public readonly remainingSeconds: number;
}

/**
 * User co phien thi thu cung mon dang IN_PROGRESS - khong the bat dau phien moi.
 * HTTP 409. `existingSessionId` la ID phien dang trong tien trinh.
 * Frontend hien: "Ban dang co phien thi chua hoan thanh. Hay hoan thanh hoac cho het gio."
 */
export class ExamSessionAlreadyActiveError extends ExamError {
  constructor(existingSessionId: string) {
    super(
      `Ban dang co phien thi thu chua hoan thanh ('${existingSessionId}'). Hay hoan thanh hoac cho het gio.`,
      'EXAM_SESSION_ALREADY_ACTIVE',
    );
    this.existingSessionId = existingSessionId;
  }

  public readonly existingSessionId: string;
}

/**
 * Du lieu cau hoi (options/correctAnswer) khong khop voi questionType.
 * Dung cho ca API admin tao/sua cau hoi VA khi import Excel (moi dong loi
 * se duoc bat va chuyen thanh ExamImportRowError theo so dong).
 */
export class ExamQuestionInvalidError extends ExamError {
  constructor(message: string) {
    super(message, 'EXAM_QUESTION_INVALID');
  }
}

/** File Excel import khong dung dinh dang (thieu sheet/cot bat buoc). */
export class ExamImportFileInvalidError extends ExamError {
  constructor(message: string) {
    super(message, 'EXAM_IMPORT_FILE_INVALID');
  }
}
