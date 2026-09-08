-- CreateIndex
CREATE INDEX `Comment_feedPostId_createdAt_idx` ON `Comment`(`feedPostId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_feedPostId_fkey` FOREIGN KEY (`feedPostId`) REFERENCES `FeedPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
