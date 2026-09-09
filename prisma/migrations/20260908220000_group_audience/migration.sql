-- AlterTable
ALTER TABLE `Group` ADD COLUMN `audience` VARCHAR(191) NOT NULL DEFAULT 'EDUCATOR';

-- CreateIndex
CREATE INDEX `Group_audience_idx` ON `Group`(`audience`);
