-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundAmount" DECIMAL(65,30),
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "stripeRefundId" TEXT;
