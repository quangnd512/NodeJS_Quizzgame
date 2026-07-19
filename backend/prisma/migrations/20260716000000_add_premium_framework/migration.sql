-- Feature 015 — Khung Free/Premium
-- Them 3 truong Premium vao bang users:
--   premiumExpiresAt      : han Premium duoc admin cap thu cong (theo thang)
--   premiumSince          : moc kich hoat Premium gan nhat, dung tinh streak freeze
--   premiumExpiryWarnedAt : chong gui trung thong bao canh bao sap het han
ALTER TABLE "users" ADD COLUMN "premiumExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "premiumSince" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "premiumExpiryWarnedAt" TIMESTAMP(3);

-- CreateIndex: ho tro cron quet user sap het han Premium (WHERE premiumExpiresAt BETWEEN now AND now+24h)
CREATE INDEX "users_premiumExpiresAt_idx" ON "users"("premiumExpiresAt");

-- AlterEnum: PREMIUM_GRANTED (admin cap Premium thu cong), PREMIUM_EXPIRING_SOON (cron canh bao sap het han)
ALTER TYPE "NotificationType" ADD VALUE 'PREMIUM_GRANTED';
ALTER TYPE "NotificationType" ADD VALUE 'PREMIUM_EXPIRING_SOON';

-- CreateTable: AppSettings - bang cau hinh toan cuc, CHI 1 dong duy nhat (singleton, id co dinh)
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultPremiumForAll" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
