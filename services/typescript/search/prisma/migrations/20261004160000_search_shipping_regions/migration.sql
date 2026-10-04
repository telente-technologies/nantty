-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "shipping_regions" TEXT[] DEFAULT ARRAY[]::TEXT[];
