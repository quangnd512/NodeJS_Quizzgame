// Khai bao kieu du lieu cho tung navigator - giup cac man hinh dung `useNavigation`/`navigation.navigate`
// co goi y kieu (autocomplete) + bat loi luc bien dich neu goi sai ten man hinh/thieu tham so.
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StartSessionResult, CompleteResult } from '../api/practice';
import type { StartExamResult } from '../api/exam';
import type { BattleMatchEndedPayload } from '../battle/battleSocket';

/** Stack luc CHUA dang nhap - man Dang nhap hoc sinh + loi vao Dang nhap Admin. */
export type AuthStackParamList = {
  Login: undefined;
  AdminLogin: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

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

export type PracticeStackScreenProps<T extends keyof PracticeStackParamList> =
  NativeStackScreenProps<PracticeStackParamList, T>;

/** Stack thi thu (Exam tab). */
export type ExamStackParamList = {
  ExamList: undefined;
  ExamTaking: { session: StartExamResult };
  ExamResult: { sessionId: string };
};

export type ExamStackScreenProps<T extends keyof ExamStackParamList> =
  NativeStackScreenProps<ExamStackParamList, T>;

/** Stack thi dau doi khang (truy cap tu Profile). */
export type BattleStackParamList = {
  BattleHome: undefined;
  // BattleMatch khong dung: BattleScreen xu ly toan bo phase (setup/queue/play) trong 1 man hinh
  BattleResult: { ended: BattleMatchEndedPayload; opponentName: string };
};

export type BattleStackScreenProps<T extends keyof BattleStackParamList> =
  NativeStackScreenProps<BattleStackParamList, T>;

/** Stack trong tab Ho so — cho phep ProfileScreen push cac man hinh phu. */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Notifications: undefined;
  WrongAnswers: undefined;
  Submissions: undefined;
  Battle: undefined; // BattleStackNavigator luon bat dau tu BattleHome
};

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;

/** 5 tab chinh cua hoc sinh. */
export type MainTabParamList = {
  Practice: NavigatorScreenParams<PracticeStackParamList>;
  Exam: NavigatorScreenParams<ExamStackParamList>;
  Leaderboard: undefined;
  Progress: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<MainTabParamList, T>;

/** Stack rieng cho Admin - hoan toan tach biet, khong chia se man hinh voi luong hoc sinh. */
export type AdminStackParamList = {
  AdminHome: undefined;
};

// ─── Screens truy cap tu Profile (dung root stack neu co, hoac modal) ──────────
// Cac man hinh sau duoc push len RootNavigator neu can (NotificationScreen, WrongAnswersScreen,
// SubmissionsScreen, BattleStack). Hien tai dung Navigation.getParent va push tu ProfileScreen.
