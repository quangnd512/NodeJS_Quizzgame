export type WrongAnswerSource = 'practice' | 'exam';

export type ExamQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';

export interface WrongAnswerQuestionDetail {
  id: string;
  content: string;
  type: ExamQuestionType;
  subjectId: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
}

export interface WrongAnswerListItem {
  id: number;
  wrongCount: number;
  lastWrongAt: Date;
  expiresAt: Date;
  source: WrongAnswerSource;
  question: WrongAnswerQuestionDetail;
}

export interface WrongAnswerListResponse {
  data: WrongAnswerListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RetryResult {
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
}
