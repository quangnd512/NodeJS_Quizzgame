// Script kiem thu nhanh (smoke test) cho module "Ngan hang cau hoi" (Question Bank).
// Kiem tra: CRUD cau hoi trong kho, getUsage, hard delete (co guard),
// addFromBank (lay cau tu kho vao de thi, skip duplicate).
//
// Chay: npx tsx src/scripts/smoke-test-question-bank.ts

import { prisma } from '../lib/prisma.js';
import { questionBankService } from '../services/exam/question-bank.service.js';
import { examService } from '../services/exam/exam.service.js';
import {
  QuestionBankNotFoundError,
  QuestionBankDeleteBlockedError,
} from '../services/exam/question-bank.errors.js';

const TITLE_PREFIX = '[SMOKE-QB]';
const SUBJECT = 'TOAN';
const TEST_USER = 'smoke-qb-user';

let bankId1 = '';
let bankId2 = '';
let bankId3 = '';
let paperId = '';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ THAT BAI: ${message}`);
  console.log(`✅ ${message}`);
}

async function cleanup(): Promise<void> {
  // Xoa theo thu tu phu thuoc FK
  const papers = await prisma.examPaper.findMany({
    where: { title: { startsWith: TITLE_PREFIX } },
    select: { id: true },
  });
  const paperIds = papers.map((p) => p.id);

  const sessions = await prisma.examSession.findMany({
    where: { OR: [{ examPaperId: { in: paperIds } }, { userId: TEST_USER }] },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  await prisma.examAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.examQuestion.deleteMany({ where: { examPaperId: { in: paperIds } } });
  await prisma.examPaper.deleteMany({ where: { id: { in: paperIds } } });
  await prisma.questionBank.deleteMany({ where: { questionText: { startsWith: TITLE_PREFIX } } });
  await prisma.pointTransaction.deleteMany({ where: { userId: TEST_USER } });
  await prisma.userPoints.deleteMany({ where: { userId: TEST_USER } });
}

// ---------------------------------------------------------------------------
// HAPPY PATH TESTS
// ---------------------------------------------------------------------------

async function testCreateAndList(): Promise<void> {
  console.log('\n--- [Happy Path] Tao va lay danh sach cau hoi ---');

  // Tao 3 cau hoi voi 3 dang khac nhau
  const q1 = await questionBankService.createQuestion({
    subject: SUBJECT,
    chapter: 'Dai so',
    difficulty: 1,
    questionType: 'MCQ_4',
    points: 0.25,
    questionText: `${TITLE_PREFIX} MCQ: Cau hoi trac nghiem 1`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    explanation: 'Giai thich MCQ',
    examYear: 2024,
    examCode: 'De 101',
  });
  bankId1 = q1.id;
  assert(q1.questionType === 'MCQ_4', 'Tao MCQ_4 thanh cong');
  assert(q1.isActive === true, 'isActive mac dinh la true');
  assert(q1.examYear === 2024, 'examYear duoc luu dung');

  const q2 = await questionBankService.createQuestion({
    subject: SUBJECT,
    chapter: 'Hinh hoc',
    difficulty: 2,
    questionType: 'TRUE_FALSE_4',
    points: 1.0,
    questionText: `${TITLE_PREFIX} TF: Cau phat bieu dung sai`,
    options: ['Phat bieu a', 'Phat bieu b', 'Phat bieu c', 'Phat bieu d'],
    correctAnswer: [true, false, true, false],
  });
  bankId2 = q2.id;
  assert(q2.questionType === 'TRUE_FALSE_4', 'Tao TRUE_FALSE_4 thanh cong');

  const q3 = await questionBankService.createQuestion({
    subject: SUBJECT,
    difficulty: 3,
    questionType: 'FILL_BLANK',
    points: 0.5,
    questionText: `${TITLE_PREFIX} FILL: Dien vao cho trong`,
    correctAnswer: ['dap an 1', 'dap an 2'],
  });
  bankId3 = q3.id;
  assert(q3.questionType === 'FILL_BLANK', 'Tao FILL_BLANK thanh cong');
  assert(q3.chapter === null, 'chapter null khi khong truyen');

  // Lay danh sach - tat ca 3 cau
  const list = await questionBankService.listQuestions({ subject: SUBJECT, isActive: true });
  const ids = list.items.map((q) => q.id);
  assert(ids.includes(bankId1) && ids.includes(bankId2) && ids.includes(bankId3), 'listQuestions tra ve du 3 cau vua tao');

  // Filter theo chuong
  const byChapter = await questionBankService.listQuestions({ chapter: 'Dai so' });
  assert(byChapter.items.some((q) => q.id === bankId1), 'Filter chapter hoat dong');
  assert(!byChapter.items.some((q) => q.id === bankId3), 'Filter chapter loai cau khong co chuong');

  // Filter theo do kho
  const byDiff = await questionBankService.listQuestions({ difficulty: 3 });
  assert(byDiff.items.some((q) => q.id === bankId3), 'Filter difficulty=3 hoat dong');

  // Tim kiem theo noi dung
  const bySearch = await questionBankService.listQuestions({ search: 'FILL: Dien vao' });
  assert(bySearch.items.some((q) => q.id === bankId3), 'Tim kiem theo noi dung hoat dong');
}

async function testUpdate(): Promise<void> {
  console.log('\n--- [Happy Path] Cap nhat cau hoi ---');

  const updated = await questionBankService.updateQuestion(bankId1, {
    chapter: 'Giai tich',
    difficulty: 2,
    isActive: false,
  });
  assert(updated.chapter === 'Giai tich', 'cap nhat chapter thanh cong');
  assert(updated.difficulty === 2, 'cap nhat difficulty thanh cong');
  assert(updated.isActive === false, 'cap nhat isActive=false thanh cong');

  // Bat lai truoc khi test tiep
  await questionBankService.updateQuestion(bankId1, { isActive: true, chapter: 'Dai so', difficulty: 1 });
}

async function testAddFromBank(): Promise<void> {
  console.log('\n--- [Happy Path] Them cau tu kho vao de thi ---');

  const paper = await examService.createExamPaper({
    subject: SUBJECT,
    title: `${TITLE_PREFIX} De Thi Thu`,
    durationMinutes: 50,
  });
  paperId = paper.id;

  // Them 2 cau tu kho
  const r1 = await questionBankService.addFromBank(paperId, {
    questionBankIds: [bankId1, bankId2],
  });
  assert(r1.added === 2, 'Them 2 cau tu kho vao de thi');
  assert(r1.skipped === 0, 'Khong co cau bi bo qua lan dau');

  // Them lai cung 2 cau (duplicate) + 1 cau moi
  const r2 = await questionBankService.addFromBank(paperId, {
    questionBankIds: [bankId1, bankId2, bankId3],
  });
  assert(r2.added === 1, 'Chi them 1 cau moi, skip 2 cau da co');
  assert(r2.skipped === 2, 'Bo qua 2 cau trung lap');

  // Kiem tra ExamQuestion da duoc tao va lien ket
  const questions = await prisma.examQuestion.findMany({
    where: { examPaperId: paperId },
    select: { questionBankId: true },
  });
  assert(questions.length === 3, 'De thi co dung 3 cau sau 2 lan addFromBank');
  const bankIds = new Set(questions.map((q) => q.questionBankId));
  assert(bankIds.has(bankId1) && bankIds.has(bankId2) && bankIds.has(bankId3), 'ExamQuestion lien ket dung questionBankId');
}

async function testGetUsage(): Promise<void> {
  console.log('\n--- [Happy Path] Kiem tra usage cau hoi ---');

  // bankId1 dang duoc dung trong paperId
  const usage1 = await questionBankService.getUsage(bankId1);
  assert(usage1.totalExamPapers === 1, 'bankId1 dang dung trong 1 de thi');
  assert(usage1.examPapers[0]!.paperId === paperId, 'paperId khop');
  assert(usage1.hasActiveSession === false, 'Chua co phien thi thu nao dang dien ra');

  // bankId3 da duoc them vao paperId trong testAddFromBank
  const usage3 = await questionBankService.getUsage(bankId3);
  assert(usage3.totalExamPapers === 1, 'bankId3 dang dung trong 1 de thi');
  assert(usage3.hasActiveSession === false, 'Khong co session');
}

async function testDelete(): Promise<void> {
  console.log('\n--- [Happy Path] Xoa cau hoi khoi kho ---');

  // Tao cau hoi moi de xoa (khong dung trong de thi nao)
  const standalone = await questionBankService.createQuestion({
    subject: SUBJECT,
    difficulty: 1,
    questionType: 'MCQ_4',
    points: 0.25,
    questionText: `${TITLE_PREFIX} Cau hoi de xoa`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 1,
  });
  await questionBankService.deleteQuestion(standalone.id);

  // Verify da bi xoa
  const found = await prisma.questionBank.findUnique({ where: { id: standalone.id } });
  assert(found === null, 'Cau hoi da bi hard delete khoi DB');
}

// ---------------------------------------------------------------------------
// EDGE CASE TESTS
// ---------------------------------------------------------------------------

async function testPagination(): Promise<void> {
  console.log('\n--- [Edge Case] Phan trang ---');

  const page1 = await questionBankService.listQuestions({ subject: SUBJECT, page: 1, pageSize: 2, isActive: true });
  assert(page1.items.length <= 2, 'page 1 toi da 2 phan tu');
  assert(page1.pageSize === 2, 'pageSize duoc tra ve dung');

  // pageSize=0 phai duoc clamp len 1
  const clamped = await questionBankService.listQuestions({ pageSize: 0 });
  assert(clamped.pageSize === 1, 'pageSize=0 duoc clamp len 1');
}

async function testAddFromBankInactiveQuestion(): Promise<void> {
  console.log('\n--- [Edge Case] addFromBank voi cau hoi isActive=false ---');

  // Tat cau hoi bankId3 roi thu them vao 1 de thi moi
  await questionBankService.updateQuestion(bankId3, { isActive: false });

  const paper2 = await examService.createExamPaper({
    subject: SUBJECT,
    title: `${TITLE_PREFIX} De Thu 2`,
    durationMinutes: 30,
  });
  const r = await questionBankService.addFromBank(paper2.id, {
    questionBankIds: [bankId3],
  });

  assert(r.added === 0, 'Cau inactive khong duoc them vao de thi');
  assert(r.skipped === 1, 'Cau inactive bi tinh la skipped');

  await questionBankService.updateQuestion(bankId3, { isActive: true });
  // Xoa paper2 de cleanup
  await prisma.examQuestion.deleteMany({ where: { examPaperId: paper2.id } });
  await prisma.examPaper.delete({ where: { id: paper2.id } });
}

// ---------------------------------------------------------------------------
// AUTO-FILL TESTS
// ---------------------------------------------------------------------------

async function testAutoFillHappyPath(): Promise<void> {
  console.log('\n--- [Happy Path] autoFillFromBank lay cau tu dong ---');

  // Tao them cau de kho du so luong theo ti le (can >= 2 cau easy, 1 medium, 1 hard)
  // bankId2 (difficulty=2, da restore isActive=true), bankId3 (difficulty=3, da restore)
  // bankId1 da bi xoa boi testDeleteAfterSessionCompleted... cần tạo lại

  // Tao de thi moi de test autoFill
  const paperAF = await examService.createExamPaper({
    subject: SUBJECT,
    title: `${TITLE_PREFIX} De AutoFill`,
    durationMinutes: 50,
  });

  // Kho hien co: bankId2 (medium), bankId3 (hard) cung mon TOAN
  // count=2: easyCount=1, mediumCount=1, hardCount=0
  // Kho khong co easy -> shortage=1, medium=1 -> added=1
  const r1 = await questionBankService.autoFillFromBank(paperAF.id, { count: 2 });
  assert(r1.added >= 0, 'autoFillFromBank khong throw khi chay hop le');
  assert(r1.added + r1.shortage === 2, 'added + shortage = count yeu cau (2)');

  // Dem kiem tra so ExamQuestion duoc tao
  const questions = await prisma.examQuestion.findMany({
    where: { examPaperId: paperAF.id, questionBankId: { not: null } },
  });
  assert(questions.length === r1.added, 'So ExamQuestion khop voi r1.added');

  // Xoa paper test
  await prisma.examQuestion.deleteMany({ where: { examPaperId: paperAF.id } });
  await prisma.examPaper.delete({ where: { id: paperAF.id } });
}

async function testAutoFillShortage(): Promise<void> {
  console.log('\n--- [Edge Case] autoFillFromBank khi kho khong du cau theo ti le ---');

  const paperSh = await examService.createExamPaper({
    subject: SUBJECT,
    title: `${TITLE_PREFIX} De Shortage`,
    durationMinutes: 50,
  });

  // Dem tong so cau trong kho cung mon, yeu cau nhieu hon 1 cau de chac chan shortage > 0.
  // Ly do: toInsert.length <= bankCount luon dung (khong the lay nhieu hon so co),
  // nen count = bankCount + 1 dam bao shortage >= 1.
  const bankCount = await prisma.questionBank.count({ where: { subject: SUBJECT, isActive: true } });
  const requestCount = bankCount + 1;

  const r = await questionBankService.autoFillFromBank(paperSh.id, { count: requestCount });
  assert(r.shortage > 0, 'shortage > 0 khi yeu cau nhieu hon tong so cau trong kho');
  assert(r.added + r.shortage === requestCount, 'added + shortage = so cau yeu cau');
  assert(r.skipped === 0, 'skipped = 0 (khong co duplicate trong lan autoFill dau)');

  // Xoa paper test
  await prisma.examQuestion.deleteMany({ where: { examPaperId: paperSh.id } });
  await prisma.examPaper.delete({ where: { id: paperSh.id } });
}

async function testAutoFillSkipExisting(): Promise<void> {
  console.log('\n--- [Edge Case] autoFillFromBank bo qua cau da co trong de ---');

  const paperSkip = await examService.createExamPaper({
    subject: SUBJECT,
    title: `${TITLE_PREFIX} De Skip Existing`,
    durationMinutes: 50,
  });

  // Lan 1: them cau tu dong
  const r1 = await questionBankService.autoFillFromBank(paperSkip.id, { count: 5 });

  // Lan 2: goi lai -> cac cau da them o lan 1 phai bi loai khoi existingBankIds
  const r2 = await questionBankService.autoFillFromBank(paperSkip.id, { count: 5 });
  assert(r2.skipped === 0, 'autoFill lan 2: skipped=0 (khong duplicate, chi lay cau chua co)');

  const allQ = await prisma.examQuestion.findMany({
    where: { examPaperId: paperSkip.id, questionBankId: { not: null } },
    select: { questionBankId: true },
  });
  const uniqueIds = new Set(allQ.map((q) => q.questionBankId));
  assert(uniqueIds.size === allQ.length, 'Khong co duplicate questionBankId trong de sau 2 lan autoFill');

  // Xoa paper test
  await prisma.examQuestion.deleteMany({ where: { examPaperId: paperSkip.id } });
  await prisma.examPaper.delete({ where: { id: paperSkip.id } });
}

async function testAutoFillPaperNotFound(): Promise<void> {
  console.log('\n--- [Error Case] autoFillFromBank voi examPaper khong ton tai ---');
  const { ExamPaperNotFoundError } = await import('../services/exam/exam.errors.js');
  try {
    await questionBankService.autoFillFromBank('non-existent-paper-id-000', { count: 5 });
    assert(false, 'Phai throw ExamPaperNotFoundError');
  } catch (err) {
    assert(err instanceof ExamPaperNotFoundError, 'Throw ExamPaperNotFoundError khi paperId khong ton tai');
  }
}

// ---------------------------------------------------------------------------
// ERROR CASE TESTS
// ---------------------------------------------------------------------------

async function testGetUsageNotFound(): Promise<void> {
  console.log('\n--- [Error Case] getUsage voi ID khong ton tai ---');
  try {
    await questionBankService.getUsage('non-existent-id-00000000000');
    assert(false, 'Phai throw QuestionBankNotFoundError');
  } catch (err) {
    assert(err instanceof QuestionBankNotFoundError, 'Throw QuestionBankNotFoundError khi ID khong ton tai');
  }
}

async function testUpdateNotFound(): Promise<void> {
  console.log('\n--- [Error Case] updateQuestion voi ID khong ton tai ---');
  try {
    await questionBankService.updateQuestion('non-existent-id-00000000000', { difficulty: 1 });
    assert(false, 'Phai throw QuestionBankNotFoundError');
  } catch (err) {
    assert(err instanceof QuestionBankNotFoundError, 'Throw QuestionBankNotFoundError khi update ID khong ton tai');
  }
}

async function testDeleteBlockedByActiveSession(): Promise<void> {
  console.log('\n--- [Error Case] Xoa cau hoi khi con phien thi thu IN_PROGRESS ---');

  // Tao phien thi gia lap (IN_PROGRESS) cho paperId
  await prisma.userPoints.upsert({
    where: { userId: TEST_USER },
    create: { userId: TEST_USER, currentPoints: 5000, version: 0 },
    update: { currentPoints: 5000, version: 0 },
  });

  // Tao ExamSession IN_PROGRESS thu cong (giam sat trang thai)
  await prisma.examSession.create({
    data: {
      userId: TEST_USER,
      examPaperId: paperId,
      subjectId: SUBJECT,
      durationMinutes: 50,
      status: 'IN_PROGRESS',
    },
  });

  try {
    await questionBankService.deleteQuestion(bankId1);
    assert(false, 'Phai throw QuestionBankDeleteBlockedError khi con phien IN_PROGRESS');
  } catch (err) {
    assert(err instanceof QuestionBankDeleteBlockedError, 'Throw QuestionBankDeleteBlockedError dung');
  }

  // Don dep: ket thuc phien gia lap
  await prisma.examSession.updateMany({
    where: { examPaperId: paperId, status: 'IN_PROGRESS', userId: TEST_USER },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}

async function testDeleteAfterSessionCompleted(): Promise<void> {
  console.log('\n--- [Error Case] Xoa cau hoi khi phien da COMPLETED (phai cho phep) ---');

  // Gio tat ca session da COMPLETED, delete phai thanh cong
  // bankId1 van con trong paperId (examQuestion), nhung khong co session IN_PROGRESS
  await questionBankService.deleteQuestion(bankId1);

  // Verify ExamQuestion.questionBankId da duoc set NULL (boi FK ON DELETE SET NULL)
  const examQ = await prisma.examQuestion.findFirst({
    where: { examPaperId: paperId, questionBankId: null },
  });
  assert(examQ !== null, 'ExamQuestion.questionBankId duoc set NULL sau khi xoa bankId1 (FK ON DELETE SET NULL)');

  const deleted = await prisma.questionBank.findUnique({ where: { id: bankId1 } });
  assert(deleted === null, 'bankId1 da bi xoa khoi question_bank');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== SMOKE TEST: Ngan hang cau hoi (Question Bank) ===\n');

  try {
    await cleanup();
    console.log('🧹 Cleanup truoc khi chay: OK');

    // Happy path
    await testCreateAndList();
    await testUpdate();
    await testAddFromBank();
    await testGetUsage();
    await testDelete();

    // Edge cases
    await testPagination();
    await testAddFromBankInactiveQuestion();

    // Auto-fill tests
    await testAutoFillHappyPath();
    await testAutoFillShortage();
    await testAutoFillSkipExisting();

    // Error cases
    await testAutoFillPaperNotFound();
    await testGetUsageNotFound();
    await testUpdateNotFound();
    await testDeleteBlockedByActiveSession();
    await testDeleteAfterSessionCompleted();

    console.log('\n🎉 TAT CA SMOKE TEST DA PASS!\n');
  } catch (err) {
    console.error('\n', err);
    process.exit(1);
  } finally {
    await cleanup();
    console.log('🧹 Cleanup sau khi chay: OK');
    await prisma.$disconnect();
  }
}

void main();
