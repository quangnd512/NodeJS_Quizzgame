// Các kiểu dữ liệu (types/interfaces) + hằng số dùng chung cho module
// "Học sinh đóng góp câu hỏi" (Student Question Submissions).

/** Trạng thái xử lý của 1 câu hỏi học sinh gửi. */
export const SUBMISSION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Số câu hỏi tối đa 1 học sinh được gửi trong 1 ngày (chống spam). */
export const SUBMISSION_DAILY_LIMIT = 5;

/** Điểm thưởng khi câu hỏi được admin duyệt vào ngân hàng. */
export const SUBMISSION_APPROVE_POINTS = 30;

/** Điểm thưởng mỗi lần câu hỏi (đã duyệt) được thêm vào 1 đề thi thật. */
export const SUBMISSION_USAGE_POINTS_PER_USE = 5;

/** Tổng điểm thưởng "usage" tối đa cho 1 câu hỏi (không cộng vượt quá mức này). */
export const SUBMISSION_USAGE_POINTS_CAP = 100;

/** Ngưỡng similarity (0.0 - 1.0) để coi là "cảnh báo trùng lặp" khi admin duyệt. */
export const SUBMISSION_DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

/** Câu hỏi học sinh gửi — dạng đầy đủ trả về cho client (học sinh xem của mình / admin xem). */
export interface SubmissionDto {
  id: string;
  userId: string;
  subject: string;
  chapter: string | null;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  status: SubmissionStatus;
  /** Ghi chú của admin — bắt buộc khi REJECTED (lý do), tuỳ chọn khi APPROVED. */
  adminNote: string | null;
  /** ID bản ghi QuestionBank được tạo ra sau khi duyệt (null khi chưa duyệt). */
  questionBankId: string | null;
  usageCount: number;
  usagePointsEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Input tạo mới 1 câu hỏi gửi (học sinh). */
export interface CreateSubmissionInput {
  subject: string;
  chapter?: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
}

/** Input cập nhật câu hỏi đã gửi — mọi trường đều tuỳ chọn, chỉ áp dụng khi còn PENDING. */
export type UpdateSubmissionInput = Partial<CreateSubmissionInput>;

/** Kết quả phân trang danh sách submission. */
export interface PaginatedSubmissions {
  items: SubmissionDto[];
  total: number;
}

/** Cảnh báo trùng lặp — câu hỏi gửi có thể giống 1 câu đã có trong Ngân hàng câu hỏi. */
export interface DuplicateWarning {
  questionBankId: string;
  /** Độ tương đồng 0.0 - 1.0 (Jaccard similarity trên tập từ đã chuẩn hoá). */
  similarity: number;
}

/** Item danh sách submission dành cho admin — kèm cảnh báo trùng lặp (nếu có). */
export type AdminSubmissionListItem = SubmissionDto & { duplicateWarning: DuplicateWarning | null };

/** Kết quả phân trang danh sách submission (admin). */
export interface PaginatedAdminSubmissions {
  items: AdminSubmissionListItem[];
  total: number;
}

/** Kết quả duyệt 1 submission. */
export interface ApproveSubmissionResult {
  id: string;
  status: 'APPROVED';
  questionBankId: string;
}

/** Kết quả từ chối 1 submission. */
export interface RejectSubmissionResult {
  id: string;
  status: 'REJECTED';
}
