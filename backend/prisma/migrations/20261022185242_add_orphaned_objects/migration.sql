-- CreateTable
CREATE TABLE "orphaned_objects" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(128) NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orphaned_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orphaned_objects_storage_key_key" ON "orphaned_objects"("storage_key");
