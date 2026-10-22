CREATE TYPE "LoanStatus" AS ENUM ('OUTSTANDING', 'REPAID');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone_number" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "friend_name" VARCHAR(80) NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "due_date" DATE NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "receipt_path" TEXT,
    "repaid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loans_amount_positive" CHECK ("amount_paise" > 0)
);

CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");
CREATE INDEX "loans_user_id_status_idx" ON "loans"("user_id", "status");
CREATE INDEX "loans_user_id_due_date_idx" ON "loans"("user_id", "due_date");
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

