// Khai bao kieu du lieu cho tung navigator — giup cac man hinh dung `useNavigation`/
// `navigation.navigate` co goi y kieu (autocomplete) + bat loi luc bien dich neu goi sai
// ten man hinh hoac thieu tham so.
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

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

// ---------------------------------------------------------------------------
// Feature stacks (long trong moi tab)
// ---------------------------------------------------------------------------

/** Stack cua tab Luyen tap. */
export type PracticeStackParamList = {
  PracticeHome: undefined;
  PracticeSession: { subjectId: string; subjectName: string };
  PracticeResult: { sessionId: string; score: number; pointsEarned: number };
};

/** Stack cua tab Thi thu. */
export type ExamStackParamList = {
  ExamList: undefined;
  ExamSession: { sessionId: string; examPaperId: string; title: string; durationMinutes: number };
  ExamResult: { sessionId: string };
};

/** Stack cua tab Xep hang. */
export type LeaderboardStackParamList = {
  LeaderboardHome: undefined;
};

/** Stack cua tab Tien do. */
export type ProgressStackParamList = {
  ProgressHome: undefined;
  WrongAnswerList: undefined;
  WrongAnswerSession: { id: number; questionContent: string; subjectId: string };
};

/** Stack cua tab Ho so. */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Notifications: undefined;
  QuestionSubmissionList: undefined;
  QuestionSubmissionForm: undefined;
  BattleLobby: undefined;
  BattleSession: { matchId: string; subject: string; stake: number; opponentName: string; isBotMatch: boolean };
  BattleResult: { matchId: string; myScore: number; opponentScore: number; result: string; pointsChange: number };
};

// ---------------------------------------------------------------------------
// 5 tab chinh
// ---------------------------------------------------------------------------

/** 5 tab chinh cua hoc sinh — khop DoD ("Luyen tap/Thi thu/Xep hang/Tien do/Ho so"). */
export type MainTabParamList = {
  PracticeTab: undefined;
  ExamTab: undefined;
  LeaderboardTab: undefined;
  ProgressTab: undefined;
  ProfileTab: undefined;
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
