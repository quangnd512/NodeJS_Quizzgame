// Cau hinh moi truong (dev/prod) cho app mobile.
//
// QUAN TRONG - vi sao KHONG the dung "localhost" mot cach don gian nhu web:
//   - Web (Vite) chay trong trinh duyet TREN CUNG may voi backend -> "localhost" luon dung.
//   - May ao Android (emulator) co mang ao rieng, KHONG chia se "localhost" voi may that ->
//     phai dung dia chi dac biet "10.0.2.2" (Android map san dia chi nay ve localhost cua may host).
//   - May ao iOS (simulator) lai CHIA SE "localhost" voi may Mac host -> dung "localhost" binh thuong.
//   - Thiet bi THAT (dien thoai that, ca Android lan iOS) khong the dung "localhost"/"10.0.2.2" -
//     phai dung dia chi IP LAN thuc te cua may chay backend (vi du "192.168.1.5"), va dien thoai
//     phai cung mang Wifi voi may do. Xem huong dan chi tiet trong README.md.
//
// Bien moi truong EXPO_PUBLIC_API_URL (duoc Expo tu dong nhung thang vao process.env luc build/dev,
// khong can them thu vien nao) - neu duoc dat, LUON UU TIEN gia tri nay (dung cho: test tren thiet
// bi that, hoac tro toi backend production khi build ban phat hanh).
import { Platform } from 'react-native';

/** Cong mac dinh backend Express dang chay o moi truong dev (xem backend/.env PORT=4000). */
const DEV_BACKEND_PORT = 4000;

/**
 * Suy ra base URL API mac dinh cho tung nen tang khi KHONG co EXPO_PUBLIC_API_URL
 * (chi ap dung trong moi truong dev - xem `getApiBaseUrl` ben duoi).
 */
function getDefaultDevApiUrl(): string {
  if (Platform.OS === 'android') {
    // Emulator Android: "10.0.2.2" la dia chi dac biet tro ve localhost cua may host.
    return `http://10.0.2.2:${DEV_BACKEND_PORT}`;
  }
  // iOS simulator + web: "localhost" hoat dong binh thuong.
  return `http://localhost:${DEV_BACKEND_PORT}`;
}

/**
 * Lay base URL cua backend API - dung 1 lan duy nhat khi module nay duoc import.
 *
 * Thu tu uu tien:
 *   1. `EXPO_PUBLIC_API_URL` (bien moi truong, xem file `.env.example`) - luon uu tien neu co.
 *   2. Neu dang o che do dev (`__DEV__`) va CHUA dat bien tren: dung fallback theo nen tang.
 *   3. Neu la production build ma CHUA dat `EXPO_PUBLIC_API_URL`: nem loi ngay luc khoi dong -
 *      tot hon la de app chay "am tham" tro ve localhost (se that bai tat ca request mot cach
 *      kho hieu cho nguoi dung that).
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    // Bo dau "/" cuoi chuoi (neu co) de noi voi path luon co dang "/api/xxx" nhat quan.
    return fromEnv.replace(/\/+$/, '');
  }

  if (__DEV__) {
    return getDefaultDevApiUrl();
  }

  throw new Error(
    '[env] Thieu bien moi truong EXPO_PUBLIC_API_URL cho ban production. ' +
      'Vui long dat gia tri nay (URL backend that) truoc khi build - xem mobile/.env.example.',
  );
}

/** Base URL backend API - vi du "http://10.0.2.2:4000" (khong co dau "/" o cuoi). */
export const API_BASE_URL = resolveApiBaseUrl();
