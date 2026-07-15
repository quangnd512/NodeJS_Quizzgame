// Các loại lỗi (custom error classes) cho module "Học sinh đóng góp câu hỏi".
// Theo cùng pattern với practice.errors.ts và points.errors.ts:
//   - Lớp cơ sở SubmissionError chứa trường `code` để ERROR_CODE_TO_HTTP_STATUS ánh xạ.
//   - Mỗi lớp con mô tả chính xác 1 tình huống lỗi cụ thể.

/** Lớp lỗi cơ sở cho mọi lỗi liên quan đến module Submissions. */
export class SubmissionError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Không tìm thấy câu hỏi gửi theo ID. */
export class SubmissionNotFoundError extends SubmissionError {
  constructor(id: string) {
    super(`Khong tim thay cau hoi gui '${id}'.`, 'SUBMISSION_NOT_FOUND');
  }
}

/** Câu hỏi gửi không thuộc về user đang đăng nhập. */
export class SubmissionNotOwnedError extends SubmissionError {
  constructor() {
    super('Cau hoi gui nay khong thuoc ve ban.', 'SUBMISSION_NOT_OWNED');
  }
}

/** Thao tác (sửa/xoá/duyệt/từ chối) chỉ được phép khi submission còn ở trạng thái PENDING. */
export class SubmissionNotPendingError extends SubmissionError {
  constructor() {
    super('Cau hoi gui nay khong con o trang thai cho duyet.', 'SUBMISSION_NOT_PENDING');
  }
}

/** User đã vượt quá số lượng câu hỏi được gửi trong 1 ngày. */
export class SubmissionRateLimitError extends SubmissionError {
  constructor(limit: number) {
    super(
      `Ban da gui toi da ${limit} cau hoi trong hom nay. Vui long thu lai vao ngay mai.`,
      'SUBMISSION_RATE_LIMIT_EXCEEDED',
    );
  }
}

/** Admin từ chối câu hỏi gửi nhưng không kèm ghi chú lý do. */
export class SubmissionRejectNoteRequiredError extends SubmissionError {
  constructor() {
    super('Phai nhap ly do khi tu choi cau hoi gui.', 'SUBMISSION_REJECT_NOTE_REQUIRED');
  }
}
