# QuizzGame Mobile (Đợt 1a — Nền móng App Di Động)

Ứng dụng di động QuizzGame, viết bằng **React Native + Expo + TypeScript**. Đây là bước **nền
móng** (foundation) đầu tiên trong roadmap đưa QuizzGame lên điện thoại — đợt này CHỈ dựng khung
ứng dụng (đăng nhập, điều hướng, dark mode, onboarding chọn môn). Các màn hình chức năng thật
(Luyện tập, Thi thử, Xếp hạng, Tiến độ) tạm hiện **"Sắp ra mắt"**, sẽ được lấp dần ở các đợt tiếp
theo (1b, 1c, 1d...).

Thư mục `mobile/` nằm CẠNH `frontend/` (web) và `backend/` (Express) trong cùng 1 mono-repo,
dùng **chung 1 backend** — không có API mới, không có thay đổi schema database.

---

## 1. Yêu cầu môi trường

- Node.js — khuyến nghị bản LTS gần nhất tương thích Expo SDK 57 (xem
  [expo.dev/versions/latest](https://docs.expo.dev/versions/latest/)). Dự án đã test với
  Node v24 (có cảnh báo `EBADENGINE` không chặn khi cài đặt — an toàn bỏ qua).
- **Backend đang chạy** ở `../backend` (xem `backend/README.md` — mặc định cổng `4000`).
- Để chạy thử app:
  - **Cách nhanh nhất (Expo Go)**: cài app "Expo Go" trên điện thoại thật (App Store/Play Store),
    quét mã QR khi chạy `npm start`. **CHỈ dùng được cho TASK 1-2 (khung app cơ bản)** — từ lúc
    tích hợp Google/Apple Sign-In (native module), phải chuyển sang "dev build" (xem mục 4).
  - **Giả lập iOS**: cần máy Mac + Xcode đã cài.
  - **Giả lập Android**: cần Android Studio + 1 AVD (Android Virtual Device) đã tạo.

---

## 2. Cài đặt & chạy nhanh

```bash
cd mobile
npm install
cp .env.example .env   # rồi điền các giá trị cần thiết (xem mục 3)
npm start              # mở Expo Dev Tools — quét QR bằng Expo Go, hoặc bấm "i"/"a" mở giả lập
```

Script khác:

```bash
npm run android   # mở thẳng giả lập/thiết bị Android
npm run ios       # mở thẳng giả lập/thiết bị iOS (chỉ chạy được trên máy Mac)
npm run web       # chạy thử trên trình duyệt (hữu ích để debug UI nhanh, KHÔNG dùng để test thật)
npm run lint      # kiểm tra lint (eslint-config-expo)
npx tsc --noEmit  # kiểm tra TypeScript compile
```

---

## 3. Biến môi trường (`.env`)

Sao chép `.env.example` → `.env` rồi điền:

| Biến | Bắt buộc? | Mô tả |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Chỉ khi test trên **thiết bị thật** hoặc build production | URL gốc backend. Nếu bỏ trống lúc dev trên máy ảo, app tự chọn giá trị phù hợp theo nền tảng (xem `src/config/env.ts`) — **Android emulator**: `http://10.0.2.2:4000` (địa chỉ đặc biệt trỏ về `localhost` của máy host), **iOS simulator**: `http://localhost:4000`. Thiết bị thật (điện thoại thật) PHẢI dùng địa chỉ IP LAN thật của máy chạy backend (ví dụ `http://192.168.1.5:4000`), và điện thoại phải cùng mạng Wifi với máy đó. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **Có** (để nút Đăng nhập Google hoạt động) | Xem hướng dẫn lấy giá trị ở mục 4a bên dưới. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Chỉ khi build iOS | Tương tự, riêng cho iOS. |

Expo tự động nhúng các biến bắt đầu bằng `EXPO_PUBLIC_` vào `process.env` lúc build/dev — không
cần cài thêm thư viện (`react-native-dotenv`, `expo-constants`...).

---

## 4. Cấu hình đăng nhập Google + Apple

⚠️ **Quan trọng**: `@react-native-google-signin/google-signin` và `expo-apple-authentication` là
**native module** — theo khuyến nghị chính thức của Expo/Google (ưu tiên hơn cách dùng
`expo-auth-session` chung chung). Đánh đổi: **không chạy được trong app Expo Go thông thường**
nữa sau khi build — phải tạo "dev build" (development build) riêng cho dự án này. Đây là hạn chế
đã biết trước của toàn ngành (không phải lỗi cấu hình) khi dùng SDK đăng nhập native chính chủ.

### 4a. Google Sign-In

1. Vào [Firebase Console](https://console.firebase.google.com) → project `quizzgamedh` (dùng
   chung với web) → **Project Settings** → **Your apps** → thêm 1 app **Android** và 1 app **iOS**
   mới (khác với app Web đã có sẵn) nếu chưa có.
   - Android: cần khai báo **package name** = `com.quizzgame.mobile` (khớp `app.json` ➝
     `android.package`) và **SHA-1 fingerprint** — chạy lệnh sau để lấy SHA-1 bản debug:
     ```bash
     # Sau khi đã chạy `npx expo prebuild` lần đầu (sinh thư mục android/)
     cd android && ./gradlew signingReport
     ```
   - iOS: cần khai báo **Bundle ID** = `com.quizzgame.mobile` (khớp `app.json` ➝ `ios.bundleIdentifier`).
2. Tải file cấu hình về, đặt ĐÚNG vị trí (đã khai báo sẵn trong `app.json`, **KHÔNG commit** —
   xem `.gitignore`):
   - `mobile/google-services.json` (Android)
   - `mobile/GoogleService-Info.plist` (iOS)
3. Lấy **Web client ID** (KHÔNG phải Android/iOS client ID) tại Google Cloud Console → APIs &
   Services → Credentials → mục "OAuth 2.0 Client IDs" → loại "Web application" (Firebase thường tự
   tạo sẵn 1 cái tên "Web client (auto created by Google Service)"). Điền vào
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` trong `.env`.
4. (iOS) Lấy **iOS client ID** tương tự, điền vào `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

### 4b. Apple Sign-In (chỉ iOS)

1. Bật "Sign In with Apple" capability cho App ID `com.quizzgame.mobile` trong
   [Apple Developer Portal](https://developer.apple.com/account) → **Certificates, Identifiers &
   Profiles**.
2. Bật provider **Apple** trong Firebase Console → Authentication → Sign-in method (Google đã có
   sẵn từ trước, dùng chung với web).
3. **Cần tài khoản Apple Developer Program (99 USD/năm)** để TEST THẬT trên thiết bị/giả lập iOS
   thật. Nếu dự án CHƯA có tài khoản này: nút "Đăng nhập bằng Apple" vẫn hiển thị và bấm được (chỉ
   ẩn trên Android theo đúng quy định của Apple), nhưng luồng đăng nhập sẽ báo lỗi cấu hình từ
   Apple thay vì đăng nhập thành công — đây là **giới hạn đã biết trước**, không phải lỗi code.

### 4c. Build dev client (bắt buộc để test đăng nhập Google/Apple thật)

```bash
npx expo prebuild        # sinh thư mục native ios/ và android/ (chỉ cần chạy lại khi đổi plugin/cấu hình native)
npx expo run:android     # build + cài dev client lên giả lập/thiết bị Android
npx expo run:ios         # build + cài dev client lên giả lập/thiết bị iOS (cần máy Mac)
```

Sau khi có dev build cài trên máy, chạy `npm start` như bình thường — dev build sẽ kết nối vào
Metro bundler giống Expo Go, nhưng CÓ ĐẦY ĐỦ native module (Google/Apple Sign-In hoạt động thật).

---

## 5. Đăng nhập Quản trị viên (Admin)

Khác hoàn toàn với luồng học sinh — KHÔNG qua Firebase/Google/Apple. Trên màn Đăng nhập, bấm
"Bạn là Quản trị viên? Đăng nhập tại đây", nhập đúng giá trị `ADMIN_SECRET` đã cấu hình ở
`backend/.env`. Secret được lưu bằng `expo-secure-store` (mã hoá, tồn tại qua các lần tắt/mở app —
khác web dùng `sessionStorage`, chỉ tồn tại trong 1 tab).

---

## 6. Kiến trúc thư mục

```
mobile/
├── App.tsx                    # Điểm vào — lắp ráp toàn bộ Provider
├── app.json                   # Cấu hình Expo (tên app, plugin native, bundle id...)
├── .env.example                # Mẫu biến môi trường
└── src/
    ├── config/env.ts           # Base URL API theo môi trường/nền tảng
    ├── api/                    # Gọi API backend (client.ts = wrapper fetch dùng chung)
    │   ├── client.ts            # request()/adminRequest() + cơ chế tự đăng xuất khi 401
    │   ├── auth.ts, users.ts, admin.ts, hello.ts
    ├── storage/secureStore.ts  # Wrapper DUY NHẤT quanh expo-secure-store (JWT, admin secret, theme)
    ├── auth/                   # Luồng xác thực HỌC SINH
    │   ├── firebase.ts          # Khởi tạo Firebase JS SDK
    │   ├── googleSignIn.ts, appleSignIn.ts
    │   └── AuthContext.tsx      # State machine: booting → signedOut/onboarding/signedIn
    ├── admin/                  # Luồng xác thực ADMIN — tách biệt hoàn toàn khỏi auth/
    │   ├── AdminAuthContext.tsx
    │   ├── AdminLoginScreen.tsx, AdminHomeScreen.tsx
    ├── theme/                  # Dark mode (ThemeContext.tsx + colors.ts)
    ├── network/NetworkBanner.tsx
    ├── navigation/              # RootNavigator quyết định hiển thị stack nào
    │   ├── RootNavigator.tsx, AuthStackNavigator.tsx, MainTabNavigator.tsx, AdminStackNavigator.tsx
    ├── screens/                 # Màn hình dùng chung (Login, Onboarding, ComingSoon, Profile...)
    ├── components/PrimaryButton.tsx
    └── constants/subjects.ts   # Danh mục môn học (PHẢI khớp SUBJECT_CATALOG phía backend)
```

### Quyết định kiến trúc quan trọng (để các đợt sau không phải đập đi làm lại)

- **2 Context xác thực độc lập** (`AuthContext` cho học sinh, `AdminAuthContext` cho admin) —
  không lồng nhau, không chia sẻ state. `RootNavigator` đọc cả 2 để quyết định hiển thị màn nào,
  ưu tiên Admin nếu cả 2 cùng "signedIn" (xem chú thích trong `RootNavigator.tsx`).
- **JWT nội bộ là nguồn xác thực DUY NHẤT sau khi đăng nhập** — Firebase Auth chỉ là bước trung
  gian lúc đăng nhập (lấy ID Token), dùng `inMemoryPersistence` (không lưu), KHÔNG cần thêm
  AsyncStorage. Toàn bộ phiên đăng nhập dựa vào JWT lưu trong SecureStore.
  Đây là 1 layer bảo mật tối thiểu (SecureStore + inMemoryPersistence) — chưa bao gồm certificate
  pinning hay chống root/jailbreak detection, có thể bổ sung ở đợt sau nếu cần.
- **Cơ chế tự đăng xuất khi 401** tập trung tại `api/client.ts` (listener pattern) — mọi màn hình
  KHÔNG cần tự bắt lỗi 401 riêng lẻ.
- **Nguồn sự thật cho "cần onboarding hay không"**: luôn là `GET /api/users/me` →
  `subjects.length > 0`, KHÔNG dựa vào cờ `isNewUser` (vì user có thể đã từng đăng ký qua web).
- **Danh mục môn học hardcode phía client** (`constants/subjects.ts`) vì backend chưa có endpoint
  liệt kê danh mục — PHẢI cập nhật tay nếu backend thêm/bớt môn (`SUBJECT_CATALOG` trong
  `backend/src/services/users/users.types.ts`).
- **Không dùng thư viện icon** (`@expo/vector-icons`...) — dùng emoji làm icon tab để giữ tối
  thiểu dependency ở giai đoạn nền móng; có thể đổi sang bộ icon thật khi làm UI chi tiết hơn.

---

## 7. Các hạn chế/rủi ro đã biết (không phải lỗi)

- Google/Apple Sign-In cần **dev build** (mục 4c), không chạy trong Expo Go thường sau khi đã cài
  2 thư viện native này.
- Apple Sign-In cần tài khoản Apple Developer Program để test thật trên iOS (mục 4b).
- Google Sign-In trên Android cần khai báo SHA-1 fingerprint (cả bản debug lẫn bản phát hành thật
  sau này) trong Firebase Console.
- `bundleIdentifier`/`package` hiện đặt tạm `com.quizzgame.mobile` — cần xác nhận lại với chủ dự
  án trước khi nộp lên App Store/Play Store (không thể đổi dễ dàng sau khi đã phát hành).
