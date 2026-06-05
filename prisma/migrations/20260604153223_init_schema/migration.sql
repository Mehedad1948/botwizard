/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - Made the column `chatTitle` on table `Campaign` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mediaType` on table `Post` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `firstName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_postId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "chatTitle" SET NOT NULL,
ALTER COLUMN "isActive" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "mediaType" SET NOT NULL,
ALTER COLUMN "mediaType" SET DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "PostHistory" ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
