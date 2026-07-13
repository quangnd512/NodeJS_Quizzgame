// ============================================================================
// text-similarity.utils.ts — So khớp độ tương đồng ĐƠN GIẢN giữa 2 đoạn văn bản.
//
// Dùng để CẢNH BÁO (không chặn) khi câu hỏi học sinh gửi có thể trùng/gần giống
// câu hỏi đã có trong Ngân hàng câu hỏi. Đây là thuật toán "thô" (chuẩn hoá bỏ
// dấu + viết thường + so khớp tỉ lệ từ chung — Jaccard similarity trên tập từ),
// KHÔNG xử lý đồng nghĩa/đảo vị trí câu — chỉ đủ để bắt các trường hợp copy/paste
// gần giống nhau, đúng như yêu cầu "so khớp text đơn giản" từ S1.
// ============================================================================

/**
 * Chuẩn hoá văn bản để so sánh: bỏ dấu tiếng Việt, hạ chữ thường, bỏ ký tự đặc
 * biệt (giữ chữ/số/khoảng trắng), gộp khoảng trắng thừa.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu (dải ký tự kết hợp Unicode Combining Diacritical Marks)
    .replace(/đ/gi, 'd') // "đ" không tách dấu qua NFD như các ký tự khác
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // bỏ ký tự đặc biệt/dấu câu
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Độ tương đồng Jaccard giữa 2 đoạn văn bản (tỉ lệ số từ CHUNG / tổng số từ
 * KHÁC NHAU giữa 2 tập). Trả về 0.0 - 1.0 (1.0 = trùng hoàn toàn tập từ).
 */
export function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeText(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
