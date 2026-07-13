// Script kiem thu nhanh (smoke test) cho luong "Bao cao cau hoi" cua PracticeService
// - chay truc tiep voi DB that. KHONG phai unit test chinh thuc, chi dung de
// xac nhan cac luong chinh hoat dong dung truoc khi merge.
//
// Chay: npx tsx src/scripts/smoke-test-question-reports.ts

import { prisma } from '../lib/prisma.js';
import { practiceService } from '../services/practice/practice.service.js';
import {
  QuestionNotAttemptedForReportError,
  QuestionNotFoundError,
  ReportAlreadySubmittedError,
} from '../services/practice/practice.errors.js';
import { AUTO_HIDE_REPORT_THRESHOLD } from '../services/practice/practice.types.js';

const USER_ATTEMPTED = 'smoke-test-report-user-attempted';
const USER_NOT_ATTEMPTED = 'smoke-test-report-user-not-attempted';
const AUTO_HIDE_USER_PREFIX = 'smoke-test-report-autohide-';

let questionA = '';
let questionB = '';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ THAT BAI: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function setup(): Promise<void> {
  const a = await prisma.question.create({
    data: {
      subject: 'TOAN',
      difficulty: 1,
      question: '[SMOKE TEST] 1 + 1 = ?',
      options: ['1', '2', '3', '4'],
      correctAnswer: 1,
    },
  });
  const b = await prisma.question.create({
    data: {
      subject: 'TOAN',
      difficulty: 1,
      question: '[SMOKE TEST] 2 + 2 = ?',
      options: ['1', '2', '3', '4'],
      correctAnswer: 3,
    },
  });
  questionA = a.id;
  questionB = b.id;

  // USER_ATTEMPTED da lam questionA va questionB
  await prisma.userQuestionHistory.createMany({
    data: [
      { userId: USER_ATTEMPTED, questionId: questionA },
      { userId: USER_ATTEMPTED, questionId: questionB },
    ],
  });
}

async function cleanup(): Promise<void> {
  const questionIds = [questionA, questionB].filter(Boolean);
  await prisma.questionReport.deleteMany({ where: { questionId: { in: questionIds } } });
  await prisma.userQuestionHistory.deleteMany({ where: { questionId: { in: questionIds } } });
  await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
}

async function main(): Promise<void> {
  console.log('--- Don dep du lieu test cu (neu co) va tao du lieu moi ---');
  await prisma.question.deleteMany({ where: { question: { startsWith: '[SMOKE TEST]' } } });
  await setup();

  console.log('\n--- 1. reportQuestion: bao cao cau hoi da tung lam (happy path) ---');
  await practiceService.reportQuestion(USER_ATTEMPTED, questionA, 'WRONG_ANSWER', 'Dap an dung phai la 2');
  const report = await prisma.questionReport.findUnique({
    where: { userId_questionId: { userId: USER_ATTEMPTED, questionId: questionA } },
  });
  assert(report?.status === 'PENDING', `Bao cao moi tao phai co status PENDING (thuc te: ${report?.status})`);
  assert(report?.description === 'Dap an dung phai la 2', 'Bao cao phai luu dung description');

  console.log('\n--- 2. reportQuestion: bao cao lai cau da bao cao -> ReportAlreadySubmittedError ---');
  try {
    await practiceService.reportQuestion(USER_ATTEMPTED, questionA, 'TYPO');
    assert(false, 'Phai nem ReportAlreadySubmittedError nhung khong thay');
  } catch (err) {
    assert(err instanceof ReportAlreadySubmittedError, `Loi phai la ReportAlreadySubmittedError (thuc te: ${(err as Error).constructor.name})`);
  }

  console.log('\n--- 3. reportQuestion: bao cao cau CHUA tung lam -> QuestionNotAttemptedForReportError ---');
  try {
    await practiceService.reportQuestion(USER_NOT_ATTEMPTED, questionB, 'BAD_CONTENT');
    assert(false, 'Phai nem QuestionNotAttemptedForReportError nhung khong thay');
  } catch (err) {
    assert(
      err instanceof QuestionNotAttemptedForReportError,
      `Loi phai la QuestionNotAttemptedForReportError (thuc te: ${(err as Error).constructor.name})`,
    );
    assert((err as { code?: string }).code === 'QUESTION_NOT_ATTEMPTED_FOR_REPORT', 'Loi phai co code QUESTION_NOT_ATTEMPTED_FOR_REPORT');
  }

  console.log('\n--- 4. reportQuestion: questionId khong ton tai -> QuestionNotFoundError ---');
  try {
    await practiceService.reportQuestion(USER_ATTEMPTED, 'cau-hoi-khong-ton-tai', 'OTHER');
    assert(false, 'Phai nem QuestionNotFoundError nhung khong thay');
  } catch (err) {
    assert(err instanceof QuestionNotFoundError, `Loi phai la QuestionNotFoundError (thuc te: ${(err as Error).constructor.name})`);
  }

  console.log('\n--- 5. reportQuestion: du AUTO_HIDE_REPORT_THRESHOLD bao cao PENDING -> tu dong an cau hoi ---');
  for (let i = 0; i < AUTO_HIDE_REPORT_THRESHOLD; i++) {
    const userId = `${AUTO_HIDE_USER_PREFIX}${i}`;
    await prisma.userQuestionHistory.create({ data: { userId, questionId: questionB } });
    await practiceService.reportQuestion(userId, questionB, 'BAD_CONTENT');
  }
  const hiddenQuestion = await prisma.question.findUnique({ where: { id: questionB } });
  assert(hiddenQuestion?.isActive === false, `Cau hoi B phai bi an (isActive=false) sau ${AUTO_HIDE_REPORT_THRESHOLD} bao cao PENDING`);

  console.log('\n--- 6. getReportsSummary: tong hop dung so luong va top cau bi bao cao ---');
  const summary = await practiceService.getReportsSummary();
  assert(summary.pendingReports >= AUTO_HIDE_REPORT_THRESHOLD + 1, `Tong so PENDING phai >= ${AUTO_HIDE_REPORT_THRESHOLD + 1} (thuc te: ${summary.pendingReports})`);
  const topB = summary.topReportedQuestions.find((r) => r.questionId === questionB);
  assert(!!topB && topB.count === AUTO_HIDE_REPORT_THRESHOLD, `Cau hoi B phai co ${AUTO_HIDE_REPORT_THRESHOLD} bao cao trong topReportedQuestions (thuc te: ${topB?.count})`);

  console.log('\n--- 7. updateReport: cap nhat trang thai bao cao cua cau hoi A ---');
  const updated = await practiceService.updateReport(report!.id, 'REVIEWED');
  assert(updated.status === 'REVIEWED', `Trang thai sau cap nhat phai la REVIEWED (thuc te: ${updated.status})`);
  assert(updated.autoHidden === false, 'Cau hoi A khong dat nguong nen autoHidden phai la false');

  console.log('\n--- 8. listReports: loc theo status tra ve dung danh sach ---');
  const reviewedList = await practiceService.listReports({ status: 'REVIEWED' });
  assert(
    reviewedList.items.some((r) => r.questionId === questionA && r.status === 'REVIEWED'),
    'listReports({status: REVIEWED}) phai chua bao cao cua cau hoi A',
  );

  console.log('\n--- Don dep du lieu test ---');
  await cleanup();

  console.log('\n🎉 TAT CA KIEM TRA DEU PASS!');
}

main()
  .catch((err) => {
    console.error('\n💥 SMOKE TEST THAT BAI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
