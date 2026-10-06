-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "account_id" TEXT;

-- CreateTable
CREATE TABLE "month_closes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "income" DECIMAL(14,2) NOT NULL,
    "expense" DECIMAL(14,2) NOT NULL,
    "source_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_close_items" (
    "id" TEXT NOT NULL,
    "close_id" TEXT NOT NULL,
    "goal_id" TEXT,
    "goal_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "transaction_id" TEXT,

    CONSTRAINT "month_close_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "month_closes_user_id_month_key" ON "month_closes"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "month_close_items_transaction_id_key" ON "month_close_items"("transaction_id");

-- CreateIndex
CREATE INDEX "month_close_items_close_id_idx" ON "month_close_items"("close_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closes" ADD CONSTRAINT "month_closes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closes" ADD CONSTRAINT "month_closes_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_close_items" ADD CONSTRAINT "month_close_items_close_id_fkey" FOREIGN KEY ("close_id") REFERENCES "month_closes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_close_items" ADD CONSTRAINT "month_close_items_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_close_items" ADD CONSTRAINT "month_close_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
