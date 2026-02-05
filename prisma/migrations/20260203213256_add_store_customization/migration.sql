-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "enableReviews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "logoImage" TEXT,
ADD COLUMN     "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
ADD COLUMN     "showBranding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showSocialLinks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twitterUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;
