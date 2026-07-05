export class WrongAnswerNotFoundError extends Error {
  readonly code = 'WRONG_ANSWER_NOT_FOUND';
  constructor(id: number) {
    super(`Không tìm thấy bản ghi câu sai với id=${id}.`);
  }
}
