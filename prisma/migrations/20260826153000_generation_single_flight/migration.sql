ALTER TABLE `generation_jobs`
  ADD COLUMN `activeInputKey` CHAR(71) NULL;

CREATE UNIQUE INDEX `generation_jobs_activeInputKey_key`
  ON `generation_jobs`(`activeInputKey`);
