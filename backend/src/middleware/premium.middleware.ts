// Middleware dung chung: chan request neu user KHONG phai Premium.
// Ap dung cho cac module CHI danh cho Premium (vi du On lai cau sai).
import type { NextFunction, Request, Response } from 'express';
import { premiumService } from '../services/premium/premium.service.js';

/**
 * Tao middleware Express chan request neu user hien tai KHONG phai Premium
 * (dua tren `premiumService.isUserPremium` - co tinh ca cong tac toan cuc
 * "Mac dinh Premium cho tat ca").
 *
 * `errorFactory` tao ra loi nghiep vu RIENG cua module goi (moi module co
 * `code` khac nhau, vi du WRONG_ANSWER_REVIEW_PREMIUM_ONLY) - de
 * ERROR_CODE_TO_HTTP_STATUS (app.ts) anh xa dung ma loi cho tung truong hop,
 * thay vi dung chung 1 loi generic cho moi noi.
 *
 * YEU CAU: PHAI dat SAU `verifyAppToken` trong chuoi middleware (can
 * `req.currentUser` da duoc gan san).
 *
 * Cach dung:
 * ```ts
 * router.use(verifyAppToken);
 * router.use(requirePremium(() => new WrongAnswerReviewPremiumOnlyError()));
 * ```
 */
export function requirePremium(errorFactory: () => Error) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const globalSetting = await premiumService.getGlobalPremiumSetting();
      const isPremium = premiumService.isUserPremium(req.currentUser!, globalSetting);
      if (!isPremium) {
        next(errorFactory());
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
