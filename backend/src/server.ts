// Entry point cua backend QuizzGame - khoi tao Express server
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  // Log de xac nhan server da khoi dong thanh cong
  console.log(`[QuizzGame Backend] Server dang chay tai http://localhost:${PORT}`);
});
