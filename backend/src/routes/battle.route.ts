// Routes REST cho module Thi dau doi khang (PvP Battle) - phan "khong realtime":
// cau hinh (muc cuoc hop le + so du diem) va lich su tran da dau.
// Toan bo luong choi REALTIME (ghep tran, cau hoi, nop dap an, ket thuc tran) di qua
// Socket.io namespace "/battle" (xem battle.socket.ts + battle.engine.service.ts).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { getBattleConfig, getBattleHistory } from '../services/battle/battle.match.service.js';
import { getActiveMatchSnapshot } from '../services/battle/battle.engine.service.js';
import type { ActiveBattleMatchResponse } from '../services/battle/battle.types.js';

export const battleRouter = Router();

// Tat ca route deu can xac thuc
battleRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// GET /api/battle/config — muc cuoc hop le + so du diem hien tai (de FE validate truoc khi vao hang doi)
// ---------------------------------------------------------------------------
battleRouter.get('/config', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getBattleConfig(req.currentUser!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/battle/active — tran ĐANG DIỄN RA cua user hien tai (neu co), dung
// de FE tu dong dua nguoi dung vao lai dung tran sau khi tai lai trang/dang
// nhap lai (Fix S5). CHI doc state in-memory tren process backend hien tai -
// dung y het han che 1-instance da ghi trong FEATURE_LOG.md.
// ---------------------------------------------------------------------------
battleRouter.get('/active', (req: Request, res: Response<ActiveBattleMatchResponse>, next: NextFunction): void => {
  try {
    const match = getActiveMatchSnapshot(req.currentUser!.id);
    res.status(200).json({ active: match !== null, match });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/battle/history?limit=&offset= — lich su tran da dau, phan trang, MO CHO TAT CA
// (chua khoa Premium o Dot 1/MVP nay).
// ---------------------------------------------------------------------------
battleRouter.get('/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limitRaw = req.query['limit'];
    const offsetRaw = req.query['offset'];
    const limit = typeof limitRaw === 'string' && limitRaw.trim() !== '' ? Number(limitRaw) : 20;
    const offset = typeof offsetRaw === 'string' && offsetRaw.trim() !== '' ? Number(offsetRaw) : 0;

    const result = await getBattleHistory(req.currentUser!.id, limit, offset);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
