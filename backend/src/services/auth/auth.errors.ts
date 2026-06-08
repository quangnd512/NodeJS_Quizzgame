// Cac loai loi (custom error classes) rieng cho luong Xac thuc (Authentication).
//
// Thiet ke tuong tu module Points: co lop loi co so `AuthError` de cac noi
// khac co the bat chung 1 loai, kem theo `code` rieng giup tang controller/
// middleware anh xa sang HTTP status code phu hop (401, 403, 400...).

export class AuthError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Khong tim thay header `Authorization` hoac sai dinh dang (phai la "Bearer <token>"). */
export class MissingAuthTokenError extends AuthError {
  constructor() {
    super(
      'Thieu hoac sai dinh dang token xac thuc. Vui long gui header "Authorization: Bearer <token>".',
      'MISSING_AUTH_TOKEN',
    );
  }
}

/** Token Firebase ID Token khong hop le: sai chu ky, het han, bi thu hoi, sai du an... */
export class InvalidFirebaseTokenError extends AuthError {
  constructor(reason: string) {
    super(`Token Firebase khong hop le hoac da het han (chi tiet: ${reason}).`, 'INVALID_FIREBASE_TOKEN');
  }
}

/**
 * Nem ra khi mot endpoint yeu cau user da hoan tat dang ky (co ban ghi trong
 * bang `users`) nhung Firebase UID trong token chua tung dang nhap qua
 * `POST /api/auth/login`. Client nen goi /login truoc.
 */
export class UserNotRegisteredError extends AuthError {
  constructor(firebaseUid: string) {
    super(
      `Tai khoan Firebase '${firebaseUid}' chua duoc dang ky trong he thong. ` +
        `Vui long goi POST /api/auth/login truoc de hoan tat dang nhap.`,
      'USER_NOT_REGISTERED',
    );
    this.firebaseUid = firebaseUid;
  }

  public readonly firebaseUid: string;
}

/**
 * Nem ra khi tao tai khoan moi that bai vi MOT TRUONG DUY NHAT KHAC (vi du
 * `email`) da duoc dung boi mot tai khoan Firebase khac - KHONG PHAI truong
 * hop "dua tao user" thong thuong (xem `AuthService.findOrCreateUser`).
 *
 * Tinh huong nay co the xay ra khi mot nguoi dang ky 2 tai khoan Firebase
 * khac nhau (vi du: 1 bang Google, 1 bang sdt) nhung Google tra ve cung 1
 * dia chi email da duoc lien ket voi tai khoan kia. Day la xung dot du lieu
 * THAT - khong the tu giai quyet bang cach doc lai, can bao loi ro rang cho
 * client (KHONG tra nguyen van thong bao loi ky thuat tu Prisma/Postgres ra
 * ngoai - tranh lo cau truc CSDL).
 */
export class AccountConflictError extends AuthError {
  constructor(field: string) {
    super(
      `Khong the hoan tat dang ky: thong tin '${field}' da duoc su dung boi mot tai khoan khac. ` +
        `Vui long su dung phuong thuc dang nhap khac hoac lien he ho tro.`,
      'ACCOUNT_CONFLICT',
    );
    this.field = field;
  }

  public readonly field: string;
}
