// Script seed một lần: đưa toàn bộ câu hỏi Ôn tập (bảng questions) vào Ngân hàng câu hỏi.
// Idempotent: dựa vào sourceQuestionId — câu đã có sẽ được bỏ qua, không tạo duplicate.
//
// Chạy: npx tsx src/scripts/seed-question-bank-from-questions.ts

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const BATCH_SIZE = 100;
const DEFAULT_POINTS = 0.25;

async function main(): Promise<void> {
  console.log('=== SEED: questions → question_bank ===\n');

  const totalPractice = await prisma.question.count();
  console.log(`Tổng câu hỏi Ôn tập: ${totalPractice}`);

  if (totalPractice === 0) {
    console.log('Không có câu hỏi nào trong bảng questions. Kết thúc.');
    return;
  }

  // Lấy tất cả sourceQuestionId đã có trong question_bank để bỏ qua
  const existing = await prisma.questionBank.findMany({
    where: { sourceQuestionId: { not: null } },
    select: { sourceQuestionId: true },
  });
  const existingIds = new Set(existing.map((r) => r.sourceQuestionId!));
  console.log(`Đã có trong ngân hàng (từ lần seed trước): ${existingIds.size} câu`);

  // Lấy tất cả questions chưa có trong ngân hàng
  const allQuestions = await prisma.question.findMany({
    where: { id: { notIn: existingIds.size > 0 ? [...existingIds] : [] } },
    orderBy: { createdAt: 'asc' },
  });

  const toInsert = allQuestions.filter((q) => !existingIds.has(q.id));
  console.log(`Cần seed thêm: ${toInsert.length} câu\n`);

  if (toInsert.length === 0) {
    console.log('✅ Ngân hàng câu hỏi đã đồng bộ đầy đủ. Không cần seed thêm.');
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    await prisma.questionBank.createMany({
      data: batch.map((q) => ({
        subject: q.subject,
        chapter: q.chapter,
        difficulty: q.difficulty,
        questionType: 'MCQ_4',
        points: DEFAULT_POINTS,
        questionText: q.question,
        options: q.options as Prisma.InputJsonValue,
        correctAnswer: q.correctAnswer as Prisma.InputJsonValue,
        explanation: q.explanation,
        examYear: q.examYear,
        examCode: q.examCode,
        isActive: q.isActive,
        sourceQuestionId: q.id,
      })),
      skipDuplicates: true,
    });

    inserted += batch.length;
    console.log(`Đã xử lý: ${Math.min(inserted, toInsert.length)}/${toInsert.length} câu`);
  }

  console.log(`\n🎉 Hoàn thành!`);
  console.log(`  ✅ Đã thêm vào ngân hàng: ${inserted - skipped} câu`);
  if (skipped > 0) console.log(`  ⏭  Bỏ qua (trùng): ${skipped} câu`);

  const finalCount = await prisma.questionBank.count();
  console.log(`  📚 Tổng ngân hàng câu hỏi hiện tại: ${finalCount} câu`);
}

void main()
  .catch((err) => {
    console.error('❌ Lỗi seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
