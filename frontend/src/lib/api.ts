// API client – boc cac cuoc goi den backend Express.
// Tat ca request deu dinh kem session token (JWT noi bo) vao header.

export interface UserProfile {
  id: string;
  firebaseUid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  province: string | null;
  subjects: { id: string; name: string }[];
  createdAt: string;
  lastLoginAt: string | null;
  points: number;
}

export interface LoginResult {
  token: string;
  isNewUser: boolean;
  user: UserProfile;
}

export interface SubjectEntry {
  id: string;
  name: string;
}

/** Loi tra ve tu API (co truong `error` va `message`). */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  sessionToken: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
      ...options.headers,
    },
  });

  const body = (await res.json()) as { error?: string; message?: string } & T;

  if (!res.ok) {
    throw new ApiError(
      body.error ?? 'UNKNOWN_ERROR',
      body.message ?? `Loi HTTP ${res.status}`,
      res.status,
    );
  }

  return body;
}

/** POST /api/auth/login — doi Firebase ID Token lay session token noi bo. */
export async function loginWithFirebaseToken(firebaseIdToken: string): Promise<LoginResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { Authorization: `Bearer ${firebaseIdToken}` },
  });

  const body = (await res.json()) as { error?: string; message?: string } & LoginResult;

  if (!res.ok) {
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body;
}

/** GET /api/users/me */
export async function getMyProfile(sessionToken: string): Promise<UserProfile> {
  return request<UserProfile>('/api/users/me', sessionToken);
}

/** POST /api/users/subjects */
export async function updateSubjects(
  sessionToken: string,
  subjectIds: string[],
): Promise<{ subjects: SubjectEntry[] }> {
  return request('/api/users/subjects', sessionToken, {
    method: 'POST',
    body: JSON.stringify({ subjects: subjectIds.map((id) => ({ id })) }),
  });
}

/** PUT /api/users/profile */
export async function updateProfile(
  sessionToken: string,
  data: { displayName?: string | null; phone?: string | null; school?: string | null; province?: string | null },
): Promise<UserProfile> {
  return request('/api/users/profile', sessionToken, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
