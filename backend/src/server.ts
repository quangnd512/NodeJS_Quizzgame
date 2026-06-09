// Entry point cua backend QuizzGame - khoi tao Express server
import cron from 'node-cron';
import { createApp } from './app.js';
import { practiceService } from './services/practice/practice.service.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`[QuizzGame Backend] Server dang chay tai http://localhost:${PORT}`);
});

// Cleanup phien on tap het gio hang ngay luc 3:00 AM
// (nhung phien startedAt > 1 gio truoc nhung chua completedAt)
cron.schedule('0 3 * * *', async () => {
  try {
    const count = await practiceService.cleanupExpiredSessions();
    if (count > 0) {
      console.log(`[Scheduler] Da dong ${count} phien on tap het gio.`);
    }
  } catch (err) {
    console.error('[Scheduler] Loi khi cleanup phien on tap:', err);
  }
});
