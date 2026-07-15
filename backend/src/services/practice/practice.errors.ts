// Cac loai loi (custom error classes) cho module On tap (Practice).
// Theo cung pattern voi auth.errors.ts va points.errors.ts:
//   - Lop co so PracticeError chua truong `code` de ERROR_CODE_TO_HTTP_STATUS anh xa.
//   - Moi lop con mo ta chinh xac 1 tinh huong loi cu the.

/** Lop loi co so cho moi loi lien quan den module On tap. */
export class PracticeError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Khong tim thay phien on tap theo ID. */
export class PracticeSessionNotFoundError extends PracticeError {
  constructor(sessionId: string) {
    super(`Khong tim thay phien on tap '${sessionId}'.`, 'PRACTICE_SESSION_NOT_FOUND');
  }
}

/** Phien on tap da qua 17 phut ke tu khi bat dau. */
export class PracticeSessionExpiredError extends PracticeError {
  constructor(sessionId: string) {
    super(`Phien on tap '${sessionId}' da het thoi gian (qua 17 phut).`, 'PRACTICE_SESSION_EXPIRED');
  }
}

/** Phien on tap da duoc hoan thanh truoc do — khong the tiep tuc. */
export class PracticeSessionAlreadyCompletedError extends PracticeError {
  constructor(sessionId: string) {
    super(`Phien on tap '${sessionId}' da hoan thanh.`, 'PRACTICE_SESSION_ALREADY_COMPLETED');
  }
}

/** Phien on tap khong thuoc ve user dang dang nhap. */
export class PracticeSessionNotOwnedError extends PracticeError {
  constructor(sessionId: string) {
    super(`Phien on tap '${sessionId}' khong thuoc ve ban.`, 'PRACTICE_SESSION_NOT_OWNED');
  }
}

/** User tao qua nhieu phien on tap trong 1 gio (vuot rate limit). */
export class PracticeRateLimitError extends PracticeError {
  constructor() {
    super(
      'Ban da tao qua nhieu phien on tap trong 1 gio. Vui long thu lai sau.',
      'PRACTICE_RATE_LIMIT_EXCEEDED',
    );
  }
}

/** User chua dang ky mon hoc nay (chua co trong user.subjects). */
export class SubjectNotRegisteredError extends PracticeError {
  constructor(subjectId: string) {
    super(`Ban chua dang ky mon hoc '${subjectId}'.`, 'SUBJECT_NOT_REGISTERED');
  }
}

/** Mon hoc chua co cau hoi nao trong DB. */
export class SubjectHasNoQuestionsError extends PracticeError {
  constructor(subjectId: string) {
    super(`Mon hoc '${subjectId}' chua co cau hoi nao.`, 'SUBJECT_HAS_NO_QUESTIONS');
  }
}

/** Khong tim thay cau hoi theo ID. */
export class QuestionNotFoundError extends PracticeError {
  constructor(questionId: string) {
    super(`Khong tim thay cau hoi '${questionId}'.`, 'QUESTION_NOT_FOUND');
  }
}

/** Cau hoi khong nam trong phien on tap nay (co the gian lan). */
export class QuestionNotInSessionError extends PracticeError {
  constructor(questionId: string) {
    super(`Cau hoi '${questionId}' khong nam trong phien on tap nay.`, 'QUESTION_NOT_IN_SESSION');
  }
}

/** User da bao cao cau hoi nay roi VA bao cao do van dang PENDING (chua xu ly). */
export class ReportAlreadySubmittedError extends PracticeError {
  constructor() {
    super('Ban da bao cao cau hoi nay roi.', 'REPORT_ALREADY_SUBMITTED');
  }
}

/**
 * User da tung bao cao cau hoi nay va bao cao cu DA duoc xu ly xong (FIXED/DISMISSED),
 * nhung chua gui kem co "confirmResubmit" -> can hoi xac nhan truoc khi tao bao cao moi.
 */
export class ReportResubmitConfirmRequiredError extends PracticeError {
  constructor() {
    super(
      'Ban da bao cao cau hoi nay truoc day (da duoc xu ly). Xac nhan neu muon bao cao lai.',
      'REPORT_RESUBMIT_CONFIRM_REQUIRED',
    );
  }
}

/** Khong tim thay bao cao cau hoi theo ID (dung cho endpoint resolve). */
export class QuestionReportNotFoundError extends PracticeError {
  constructor(reportId: string) {
    super(`Khong tim thay bao cao '${reportId}'.`, 'QUESTION_REPORT_NOT_FOUND');
  }
}

/**
 * Bao cao khong con o trang thai PENDING khi resolveReport() co gang xu ly —
 * chong double-resolve (double-click, retry client, hoac 2 admin xu ly gan nhu
 * dong thoi cung 1 bao cao). Dung updateMany co dieu kien status:'PENDING' de
 * "claim" bao cao truoc khi tao snapshot/update Question; neu claim that bai
 * (bao cao da bi 1 request khac xu ly truoc) thi nem loi nay de rollback transaction.
 */
export class ReportNotPendingError extends PracticeError {
  constructor() {
    super(
      'Bao cao nay khong con o trang thai cho xu ly (co the da duoc xu ly truoc do).',
      'REPORT_NOT_PENDING',
    );
  }
}

/** User chua lam cau hoi nay (khong the xem giai thich). */
export class QuestionNotAttemptedError extends PracticeError {
  constructor(questionId: string) {
    super(
      `Ban chua lam cau hoi '${questionId}' trong bat ky phien nao. Khong the xem giai thich.`,
      'QUESTION_NOT_ATTEMPTED',
    );
  }
}

/** User chua lam cau hoi nay (khong duoc bao cao cau chua tung lam). */
export class QuestionNotAttemptedForReportError extends PracticeError {
  constructor(questionId: string) {
    super(
      `Ban chi co the bao cao cau hoi da tung lam. Ban chua lam cau hoi '${questionId}'.`,
      'QUESTION_NOT_ATTEMPTED_FOR_REPORT',
    );
  }
}
