-- CreateTable
CREATE TABLE "customer_strikes" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_strikes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_strikes_email_key" ON "customer_strikes"("email");
