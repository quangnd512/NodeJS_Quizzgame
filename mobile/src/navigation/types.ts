// Khai bao kieu du lieu cho tung navigator — giup cac man hinh dung `useNavigation`/
// `navigation.navigate` co goi y kieu (autocomplete) + bat loi luc bien dich neu goi sai
// ten man hinh hoac thieu tham so.
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { StartSessionResult, CompleteResult } from '../api/practice';
import type { StartExamResult } from '../api/exam';
import type { BattleMatchEndedPayload } from '../battle/battleSocket';

// ---------------------------------------------------------------------------
// Auth stack
// ---------------------------------------------------------------------------

/** Stack luc CHUA dang nhap — man Dang nhap hoc sinh + loi vao Dang nhap Admin. */
export type AuthStackParamList = {
  Login: undefined;
  AdminLogin: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Onboarding stack
// ---------------------------------------------------------------------------

/** Stack Onboarding (dot nay chi co 1 man, giu dang Stack de de mo rong sau nay). */
export type OnboardingStackParamList = {
  SelectSubjects: undefined;
};

// ─── Nested stacks bên trong từng tab ─────────────────────────────────────────

/** Stack luyen tap (Practice tab). */
export type PracticeStackParamList = {
  PracticeHome: undefined;
  PracticeSession: { session: StartSessionResult };
  PracticeResult: {
    complete: CompleteResult;
    subject: string;
    totalQuestions: number;
    correctCount: number;
  };
};

/** Stack thi thu (Exam tab). */
export type ExamStackParamList = {
  ExamList: undefined;
  ExamTaking: { session: StartExamResult };
  ExamSession: { sessionId: string; durationMinutes: number };
  ExamResult: { sessionId: string; score?: number; subjectName?: string; pointsAwarded?: number };
};

/** Stack thi dau doi khang (truy cap tu Profile). */
export type BattleStackParamList = {
  BattleHome: undefined;
  // BattleMatch khong dung: BattleScreen xu ly toan bo phase (setup/queue/play) trong 1 man hinh
  BattleResult: { ended: BattleMatchEndedPayload; opponentName: string };
  BattleHistory: undefined;
};

export type BattleStackScreenProps<T extends keyof BattleStackParamList> =
  NativeStackScreenProps<BattleStackParamList, T>;

/** Stack xep hang (Leaderboard tab). */
export type LeaderboardStackParamList = {
  LeaderboardHome: undefined;
};

/** Stack tien do (Progress tab) — gom ca On cau sai. */
export type ProgressStackParamList = {
  ProgressHome: undefined;
  WrongAnswerList: undefined;
  WrongAnswerSession: { id: number; questionContent: string };
};

/** Stack trong tab Ho so — cho phep ProfileScreen push cac man hinh phu. */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Notifications: undefined;
  WrongAnswers: undefined;
  Submissions: undefined;
  Battle: undefined; // BattleStackNavigator luon bat dau tu BattleHome
  QuestionSubmissionList: undefined;
  QuestionSubmissionForm: undefined;
  BattleLobby: undefined;
  BattleSession: { matchId: string; subject: string; stake: number; opponentName: string; isBotMatch: boolean };
  BattleResult: { matchId: string; myScore: number; opponentScore: number; result: string; pointsChange: number };
};

/** 5 tab chinh cua hoc sinh. */
export type MainTabParamList = {
  Practice: NavigatorScreenParams<PracticeStackParamList>;
  Exam: NavigatorScreenParams<ExamStackParamList>;
  Leaderboard: undefined;
  Progress: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

// ---------------------------------------------------------------------------
// Composite props: man hinh trong stack co the dung ca navigation cua tab
// ---------------------------------------------------------------------------

export type PracticeStackScreenProps<T extends keyof PracticeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<PracticeStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ExamStackScreenProps<T extends keyof ExamStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ExamStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type LeaderboardStackScreenProps<T extends keyof LeaderboardStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<LeaderboardStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ProgressStackScreenProps<T extends keyof ProgressStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProgressStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

// ---------------------------------------------------------------------------
// Admin stack — hoan toan tach biet, khong chia se man hinh voi luong hoc sinh
// ---------------------------------------------------------------------------

export type AdminStackParamList = {
  AdminHome: undefined;
};

// ─── Screens truy cap tu Profile (dung root stack neu co, hoac modal) ──────────
// Cac man hinh sau duoc push len RootNavigator neu can (NotificationScreen, WrongAnswersScreen,
// SubmissionsScreen, BattleStack). Hien tai dung Navigation.getParent va push tu ProfileScreen.
