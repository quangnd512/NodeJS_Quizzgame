// Cac loai loi (custom error classes) cho module Thi dau doi khang (PvP Battle).
// Theo cung pattern voi practice.errors.ts / points.errors.ts:
//   - Lop co so BattleError chua truong `code` de ERROR_CODE_TO_HTTP_STATUS anh xa
//     (dung cho REST) hoac de battle.socket.ts anh xa sang payload `battle:error`
//     (dung cho Socket.io).

/** Lop loi co so cho moi loi lien quan den module Battle. */
export class BattleError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Mon hoc khong nam trong SUBJECT_CATALOG. */
export class BattleInvalidSubjectError extends BattleError {
  constructor(subject: string) {
    super(`Mon hoc '${subject}' khong hop le.`, 'BATTLE_INVALID_SUBJECT');
  }
}

/** Muc cuoc khong nam trong danh sach hop le (50/100/200/500). */
export class BattleInvalidStakeError extends BattleError {
  constructor(stake: number) {
    super(`Muc cuoc '${stake}' khong hop le.`, 'BATTLE_INVALID_STAKE');
  }
}

/** User khong du diem de vao hang doi / tao phong voi muc cuoc da chon. */
export class BattleInsufficientPointsError extends BattleError {
  constructor(required: number, available: number) {
    super(
      `Khong du diem de cuoc: can ${required}, hien co ${available}.`,
      'BATTLE_INSUFFICIENT_POINTS',
    );
  }
}

/** User da o trong hang doi roi, khong the vao them lan nua khi chua huy/ghep xong. */
export class BattleAlreadyInQueueError extends BattleError {
  constructor() {
    super('Ban dang trong hang doi tim tran, vui long cho hoac huy truoc.', 'BATTLE_ALREADY_IN_QUEUE');
  }
}

/** Huy hang doi nhung user khong (con) o trong hang doi. */
export class BattleNotInQueueError extends BattleError {
  constructor() {
    super('Ban khong o trong hang doi tim tran.', 'BATTLE_NOT_IN_QUEUE');
  }
}

/** Khong tim thay phong voi ma da nhap (chua tung tao, da bi huy, hoac da du nguoi). */
export class BattleRoomNotFoundError extends BattleError {
  constructor(roomCode: string) {
    super(`Khong tim thay phong voi ma '${roomCode}'.`, 'BATTLE_ROOM_NOT_FOUND');
  }
}

/** User tu nhap ma phong cua chinh minh vua tao. */
export class BattleCannotJoinOwnRoomError extends BattleError {
  constructor() {
    super('Ban khong the tu vao phong cua chinh minh.', 'BATTLE_CANNOT_JOIN_OWN_ROOM');
  }
}

/** Khong tim thay tran dau theo ID. */
export class BattleMatchNotFoundError extends BattleError {
  constructor(matchId: string) {
    super(`Khong tim thay tran dau '${matchId}'.`, 'BATTLE_MATCH_NOT_FOUND');
  }
}

/** User gui su kien (submit-answer...) cho 1 tran khong thuoc ve minh. */
export class BattleMatchNotOwnedError extends BattleError {
  constructor() {
    super('Tran dau nay khong thuoc ve ban.', 'BATTLE_MATCH_NOT_OWNED');
  }
}

/** Tran dau khong o trang thai IN_PROGRESS (da ket thuc/huy) nhung van co request lien quan. */
export class BattleMatchNotInProgressError extends BattleError {
  constructor(matchId: string) {
    super(`Tran dau '${matchId}' khong con dang dien ra.`, 'BATTLE_MATCH_NOT_IN_PROGRESS');
  }
}

/** Nop dap an cho cau hoi sai voi cau hien tai cua tran (da qua cau khac) hoac da tra loi roi. */
export class BattleInvalidQuestionIndexError extends BattleError {
  constructor() {
    super('Cau hoi khong hop le hoac ban da tra loi cau nay roi.', 'BATTLE_INVALID_QUESTION_INDEX');
  }
}

/** Khong du cau hoi MCQ_4 dang active trong Ngan hang cau hoi cho mon da chon. */
export class BattleNotEnoughQuestionsError extends BattleError {
  constructor(subject: string) {
    super(`Khong du cau hoi trac nghiem cho mon '${subject}' de bat dau tran.`, 'BATTLE_NOT_ENOUGH_QUESTIONS');
  }
}

/** Payload cua 1 su kien Socket.io khong dung dinh dang mong doi (thieu truong/sai kieu). */
export class BattleInvalidPayloadError extends BattleError {
  constructor(detail: string) {
    super(`Du lieu gui len khong hop le: ${detail}`, 'BATTLE_INVALID_PAYLOAD');
  }
}
