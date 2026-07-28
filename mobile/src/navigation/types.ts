// Khai bao kieu du lieu cho tung navigator - giup cac man hinh dung `useNavigation`/`navigation.navigate`
// co goi y kieu (autocomplete) + bat loi luc bien dich neu goi sai ten man hinh/thieu tham so.
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

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

/** 5 tab chinh cua hoc sinh - dung khop DoD ("Luyện tập/Thi thử/Xếp hạng/Tiến độ/Hồ sơ"). */
export type MainTabParamList = {
  Practice: undefined;
  Exam: undefined;
  Leaderboard: undefined;
  Progress: undefined;
  Profile: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<MainTabParamList, T>;

/** Stack rieng cho Admin - hoan toan tach biet, khong chia se man hinh voi luong hoc sinh. */
export type AdminStackParamList = {
  AdminHome: undefined;
};
