export class WrongAnswerNotFoundError extends Error {
  readonly code = 'WRONG_ANSWER_NOT_FOUND';
  constructor(id: number) {
    super(`Không tìm thấy bản ghi câu sai với id=${id}.`);
  }
}

/** Nem ra khi user Free co truy cap tinh nang "On lai cau sai" — chi danh cho Premium (Feature 015). */
export class WrongAnswerReviewPremiumOnlyError extends Error {
  readonly code = 'WRONG_ANSWER_REVIEW_PREMIUM_ONLY';
  constructor() {
    super('Tinh nang "On lai cau sai" chi danh cho tai khoan Premium.');
  }
}
