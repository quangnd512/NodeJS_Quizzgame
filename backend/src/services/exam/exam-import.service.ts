// Import cau hoi thi thu tu file Excel (.xlsx).
// Tach rieng khoi exam.service.ts de gioi han phu thuoc vao thu vien `xlsx`
// chi trong file nay.
//
// Quy uoc cot trong file Excel (dong 1 = header, xem docs/templates/mau-import-cau-hoi-thi-thu.xlsx):
//   Chuong | Do kho | Loai cau hoi | Diem | Noi dung cau hoi |
//   Lua chon 1 | Lua chon 2 | Lua chon 3 | Lua chon 4 | Dap an dung |
//   Giai thich | Nam thi | Ma de
//
// Quy uoc "Dap an dung" theo tung "Loai cau hoi":
//   - MCQ_4: chu cai A/B/C/D (khong phan biet hoa/thuong) hoac so 0-3.
//   - TRUE_FALSE_4: 4 gia tri Dung/Sai cach nhau boi dau phay, vi du "D,S,D,S"
//     (chap nhan D/S, Dung/Sai, True/False, T/F, 1/0) - tuong ung 4 "Lua chon".
//   - FILL_BLANK: cac dap an duoc chap nhan, cach nhau boi dau "|", vi du "Ha Noi|HN".
//     Cac cot "Lua chon" khong dung cho dang nay.
import * as XLSX from 'xlsx';
import { prisma } from '../../lib/prisma.js';
import { examService } from './exam.service.js';
import { validateQuestionShape } from './exam.service.js';
import { ExamImportFileInvalidError, ExamPaperNotFoundError, ExamQuestionInvalidError } from './exam.errors.js';
import { EXAM_QUESTION_TYPES } from './exam.types.js';
import type { CreateExamQuestionInput, ExamImportResult, ExamImportRowError, ExamQuestionType } from './exam.types.js';

/** Ten cac cot trong file Excel (dong 1 = header) - phai khop CHINH XAC voi file mau. */
const COLUMNS = {
  chapter: 'Chương',
  difficulty: 'Độ khó',
  questionType: 'Loại câu hỏi',
  points: 'Điểm',
  questionText: 'Nội dung câu hỏi',
  option1: 'Lựa chọn 1',
  option2: 'Lựa chọn 2',
  option3: 'Lựa chọn 3',
  option4: 'Lựa chọn 4',
  correctAnswer: 'Đáp án đúng',
  explanation: 'Giải thích',
  examYear: 'Năm thi',
  examCode: 'Mã đề',
} as const;

/** Doc gia tri cell dang chuoi, trim khoang trang, tra ve '' neu rong/khong co. */
function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/** Doc gia tri cell dang so, tra ve null neu rong hoac khong phai so hop le. */
function readNumber(row: Record<string, unknown>, key: string): number | null {
  const raw = row[key];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

/** Quy doi token "Dap an dung" cua dang MCQ_4 (A/B/C/D hoac 0-3) -> chi so 0-3, null neu khong hop le. */
function parseMcqAnswer(value: string): number | null {
  const t = value.trim().toUpperCase();
  if (t === 'A' || t === 'B' || t === 'C' || t === 'D') return t.charCodeAt(0) - 65;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

/** Quy doi 1 token "Dung/Sai" (TRUE_FALSE_4) -> boolean, null neu khong nhan dien duoc. */
function parseBoolToken(token: string): boolean | null {
  const t = token.trim().toUpperCase();
  if (['D', 'Đ', 'DUNG', 'ĐÚNG', 'TRUE', 'T', '1', 'X'].includes(t)) return true;
  if (['S', 'SAI', 'FALSE', 'F', '0'].includes(t)) return false;
  return null;
}

/**
 * Phan tich 1 dong du lieu Excel thanh `CreateExamQuestionInput`.
 *
 * @throws ExamQuestionInvalidError neu du lieu dong khong hop le - caller bat loi
 *   nay va chuyen thanh `ExamImportRowError` theo so dong tuong ung.
 */
export function parseExcelRow(row: Record<string, unknown>): CreateExamQuestionInput {
  const questionTypeRaw = readString(row, COLUMNS.questionType).toUpperCase();
  if (!(EXAM_QUESTION_TYPES as readonly string[]).includes(questionTypeRaw)) {
    throw new ExamQuestionInvalidError(
      `Loai cau hoi '${questionTypeRaw}' khong hop le (phai la MCQ_4, TRUE_FALSE_4 hoac FILL_BLANK).`,
    );
  }
  const questionType = questionTypeRaw as ExamQuestionType;

  const difficulty = readNumber(row, COLUMNS.difficulty);
  if (difficulty === null || ![1, 2, 3].includes(difficulty)) {
    throw new ExamQuestionInvalidError('Do kho phai la 1, 2 hoac 3.');
  }

  const points = readNumber(row, COLUMNS.points);
  if (points === null || points <= 0) {
    throw new ExamQuestionInvalidError('Diem phai la so duong.');
  }

  const questionText = readString(row, COLUMNS.questionText);
  if (questionText === '') {
    throw new ExamQuestionInvalidError('Thieu noi dung cau hoi.');
  }

  const opt1 = readString(row, COLUMNS.option1);
  const opt2 = readString(row, COLUMNS.option2);
  const opt3 = readString(row, COLUMNS.option3);
  const opt4 = readString(row, COLUMNS.option4);
  const correctAnswerRaw = readString(row, COLUMNS.correctAnswer);

  let options: string[] | undefined;
  let correctAnswer: unknown;

  switch (questionType) {
    case 'MCQ_4': {
      options = [opt1, opt2, opt3, opt4];
      const idx = parseMcqAnswer(correctAnswerRaw);
      if (idx === null) {
        throw new ExamQuestionInvalidError(
          `Dap an dung '${correctAnswerRaw}' khong hop le (phai la A/B/C/D hoac 0-3).`,
        );
      }
      correctAnswer = idx;
      break;
    }
    case 'TRUE_FALSE_4': {
      options = [opt1, opt2, opt3, opt4];
      const tokens = correctAnswerRaw.split(',');
      if (tokens.length !== 4) {
        throw new ExamQuestionInvalidError(
          'Dap an dung phai gom 4 gia tri Dung/Sai cach nhau boi dau phay (vi du: "D,S,D,S").',
        );
      }
      const parsed = tokens.map(parseBoolToken);
      if (parsed.some((v) => v === null)) {
        throw new ExamQuestionInvalidError(
          'Dap an dung chua gia tri khong hop le (chi nhan D/Đ/S, Dung/Sai, True/False, 1/0).',
        );
      }
      correctAnswer = parsed;
      break;
    }
    case 'FILL_BLANK': {
      options = undefined;
      const alternatives = correctAnswerRaw
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s !== '');
      if (alternatives.length === 0) {
        throw new ExamQuestionInvalidError('Dap an dung khong duoc de trong (dang FILL_BLANK).');
      }
      correctAnswer = alternatives;
      break;
    }
  }

  validateQuestionShape(questionType, options ?? null, correctAnswer);

  const chapter = readString(row, COLUMNS.chapter);
  const explanation = readString(row, COLUMNS.explanation);
  const examYear = readNumber(row, COLUMNS.examYear);
  const examCode = readString(row, COLUMNS.examCode);

  return {
    chapter: chapter !== '' ? chapter : undefined,
    difficulty,
    questionType,
    points,
    questionText,
    options,
    correctAnswer,
    explanation: explanation !== '' ? explanation : undefined,
    examYear: examYear !== null ? examYear : undefined,
    examCode: examCode !== '' ? examCode : undefined,
  };
}

/**
 * Import hang loat cau hoi tu file Excel (.xlsx) vao 1 de thi.
 * Cho phep THANH CONG MOT PHAN: cac dong hop le se duoc luu, cac dong loi
 * duoc bao cao kem so dong (tinh ca dong header = dong 1).
 *
 * @throws ExamPaperNotFoundError neu de thi khong ton tai
 * @throws ExamImportFileInvalidError neu file khong dung dinh dang Excel hoac khong co du lieu
 */
export async function importQuestionsFromExcel(
  examPaperId: string,
  buffer: Buffer,
): Promise<ExamImportResult> {
  const paper = await prisma.examPaper.findUnique({ where: { id: examPaperId } });
  if (!paper) throw new ExamPaperNotFoundError(examPaperId);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new ExamImportFileInvalidError('Khong doc duoc file Excel. Vui long kiem tra dinh dang file.');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName !== undefined ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    throw new ExamImportFileInvalidError('File Excel khong co sheet du lieu nao.');
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) {
    throw new ExamImportFileInvalidError('File Excel khong co du lieu (chi co dong header hoac bi rong).');
  }

  const errors: ExamImportRowError[] = [];
  const parsedRows: { rowNumber: number; input: CreateExamQuestionInput }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // dong 1 la header
    try {
      parsedRows.push({ rowNumber, input: parseExcelRow(row) });
    } catch (err) {
      errors.push({ row: rowNumber, message: err instanceof Error ? err.message : 'Loi khong xac dinh.' });
    }
  });

  let inserted = 0;
  for (const { rowNumber, input } of parsedRows) {
    try {
      await examService.createExamQuestion(examPaperId, input);
      inserted += 1;
    } catch (err) {
      errors.push({ row: rowNumber, message: err instanceof Error ? err.message : 'Loi khong xac dinh.' });
    }
  }

  errors.sort((a, b) => a.row - b.row);

  return { inserted, errors };
}
