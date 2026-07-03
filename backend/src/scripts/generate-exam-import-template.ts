// Sinh file Excel mau de admin import cau hoi thi thu hang loat.
// Chay: npm run generate:exam-template
// Output: docs/templates/mau-import-cau-hoi-thi-thu.xlsx
//
// QUAN TRONG: ten cot (dong header) o sheet "Cau hoi" phai khop CHINH XAC voi
// COLUMNS trong backend/src/services/exam/exam-import.service.ts.
import * as path from 'path';
import * as XLSX from 'xlsx';

const OUTPUT_PATH = path.resolve(__dirname, '../../../docs/templates/mau-import-cau-hoi-thi-thu.xlsx');

const HEADERS = [
  'Chương',
  'Độ khó',
  'Loại câu hỏi',
  'Điểm',
  'Nội dung câu hỏi',
  'Lựa chọn 1',
  'Lựa chọn 2',
  'Lựa chọn 3',
  'Lựa chọn 4',
  'Đáp án đúng',
  'Giải thích',
  'Năm thi',
  'Mã đề',
] as const;

type Row = Record<(typeof HEADERS)[number], string | number>;

const exampleRows: Row[] = [
  {
    'Chương': 'Cơ học',
    'Độ khó': 1,
    'Loại câu hỏi': 'MCQ_4',
    'Điểm': 0.25,
    'Nội dung câu hỏi': 'Đơn vị của lực trong hệ SI là gì?',
    'Lựa chọn 1': 'Newton (N)',
    'Lựa chọn 2': 'Joule (J)',
    'Lựa chọn 3': 'Watt (W)',
    'Lựa chọn 4': 'Pascal (Pa)',
    'Đáp án đúng': 'A',
    'Giải thích': 'Don vi luc trong he SI la Newton, ky hieu N.',
    'Năm thi': 2023,
    'Mã đề': '101',
  },
  {
    'Chương': 'Dao động cơ',
    'Độ khó': 2,
    'Loại câu hỏi': 'TRUE_FALSE_4',
    'Điểm': 1,
    'Nội dung câu hỏi': 'Mot con lac lo xo dao dong dieu hoa. Xet cac phat bieu sau:',
    'Lựa chọn 1': 'Chu ki dao dong khong phu thuoc vao bien do.',
    'Lựa chọn 2': 'Tan so goc ti le thuan voi khoi luong vat nang.',
    'Lựa chọn 3': 'Co nang cua he ti le voi binh phuong bien do.',
    'Lựa chọn 4': 'Toc do cuc dai dat duoc tai vi tri bien.',
    'Đáp án đúng': 'Đ,S,Đ,S',
    'Giải thích': 'Y1 dung, Y2 sai (ti le NGHICH), Y3 dung, Y4 sai (toc do cuc dai tai VTCB).',
    'Năm thi': '',
    'Mã đề': '',
  },
  {
    'Chương': 'Địa lý dân cư',
    'Độ khó': 1,
    'Loại câu hỏi': 'FILL_BLANK',
    'Điểm': 0.5,
    'Nội dung câu hỏi': 'Thu do cua Viet Nam la ____.',
    'Lựa chọn 1': '',
    'Lựa chọn 2': '',
    'Lựa chọn 3': '',
    'Lựa chọn 4': '',
    'Đáp án đúng': 'Hà Nội|Ha Noi|HN',
    'Giải thích': 'Thu do cua nuoc Cong hoa Xa hoi chu nghia Viet Nam la Ha Noi.',
    'Năm thi': '',
    'Mã đề': '',
  },
];

const instructionRows: (string | number)[][] = [
  ['HUONG DAN IMPORT CAU HOI THI THU TU FILE EXCEL'],
  [],
  ['1. Sheet "Cau hoi": moi dong (tu dong 2) la 1 cau hoi. Dong 1 la ten cot - KHONG sua ten cot.'],
  ['2. Cot "Loai cau hoi" nhan 1 trong 3 gia tri: MCQ_4, TRUE_FALSE_4, FILL_BLANK.'],
  ['3. Cot "Do kho" nhan 1, 2 hoac 3. Cot "Diem" la so duong (vi du 0.25, 0.5, 1).'],
  [],
  ['4. Voi MCQ_4 (1 dap an dung trong 4 lua chon):'],
  ['   - Dien du "Lua chon 1".."Lua chon 4".'],
  ['   - Cot "Dap an dung" ghi A, B, C hoac D (hoac 0-3) tuong ung lua chon dung.'],
  [],
  ['5. Voi TRUE_FALSE_4 (4 phat bieu Dung/Sai, diem theo so y dung):'],
  ['   - Dien du "Lua chon 1".."Lua chon 4" la 4 phat bieu.'],
  ['   - Cot "Dap an dung" ghi 4 gia tri Đ/S cach nhau boi dau phay, vi du: Đ,S,Đ,S'],
  ['     (tuong ung Lua chon 1=Dung, Lua chon 2=Sai, Lua chon 3=Dung, Lua chon 4=Sai).'],
  ['   - Diem dat duoc theo so y dung: 0 y -> 0%, 1 y -> 10%, 2 y -> 25%, 3 y -> 50%, 4 y -> 100% diem cau.'],
  [],
  ['6. Voi FILL_BLANK (dien tu/cum tu):'],
  ['   - Bo trong "Lua chon 1".."Lua chon 4".'],
  ['   - Cot "Dap an dung" ghi cac dap an duoc chap nhan, cach nhau boi dau "|", vi du: Ha Noi|HN'],
  ['     (he thong tu dong bo qua hoa/thuong va khoang trang du khi so sanh).'],
  [],
  ['7. Cac cot "Chương", "Giải thích", "Năm thi", "Mã đề" la TUY CHON - co the de trong.'],
  [],
  ['8. Sau khi import, cac dong loi (sai dinh dang) se duoc bao cao theo SO DONG cu the,'],
  ['   cac dong hop le van duoc luu (thanh cong mot phan).'],
];

const workbook = XLSX.utils.book_new();

const questionSheet = XLSX.utils.json_to_sheet(exampleRows, { header: [...HEADERS] });
XLSX.utils.book_append_sheet(workbook, questionSheet, 'Cau hoi');

const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows);
XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Huong dan');

XLSX.writeFile(workbook, OUTPUT_PATH);

console.log(`Da tao file mau: ${OUTPUT_PATH}`);
