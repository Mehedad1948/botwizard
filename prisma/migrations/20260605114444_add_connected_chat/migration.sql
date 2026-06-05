-- CreateTable
CREATE TABLE "ConnectedChat" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "chatTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectedChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedChat_botId_chatId_key" ON "ConnectedChat"("botId", "chatId");

-- AddForeignKey
ALTER TABLE "ConnectedChat" ADD CONSTRAINT "ConnectedChat_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
