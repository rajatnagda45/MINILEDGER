/*
  Warnings:

  - You are about to drop the column `receipt_path` on the `loans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "loans" DROP COLUMN "receipt_path";

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "storage_key" VARCHAR(128) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_loan_id_key" ON "receipts"("loan_id");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
