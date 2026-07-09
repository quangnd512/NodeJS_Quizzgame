export class NotificationNotFoundError extends Error {
  readonly code = 'NOTIFICATION_NOT_FOUND';
  constructor(id: string) {
    super(`Không tìm thấy thông báo với id=${id}.`);
  }
}

export class NotificationNotOwnedError extends Error {
  readonly code = 'NOTIFICATION_NOT_OWNED';
  constructor() {
    super('Thông báo này không thuộc về bạn.');
  }
}
