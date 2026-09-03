// Bang mau don gian dung chung toan app - CHUA dung thu vien UI kit rieng (dot nay chi la nen
// mong), nen tu dinh nghia 1 bo token mau toi thieu cho ca 2 giao dien Sang/Toi.
export interface AppColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
}

export const lightColors: AppColors = {
  background: '#F5F6FA',
  surface: '#FFFFFF',
  text: '#1A1D29',
  textMuted: '#6B7280',
  border: '#E2E4EA',
  primary: '#4F46E5',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
};

export const darkColors: AppColors = {
  background: '#121318',
  surface: '#1E2028',
  text: '#F2F3F7',
  textMuted: '#9CA0AC',
  border: '#2D2F3A',
  primary: '#818CF8',
  primaryText: '#12131F',
  danger: '#F87171',
};
