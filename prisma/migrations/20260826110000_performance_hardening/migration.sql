ALTER TABLE `projects`
  ADD COLUMN `progressPercent` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `generation_jobs`
  ADD COLUMN `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `generation_jobs_state_next_attempt_lease_idx`
  ON `generation_jobs`(`state`, `nextAttemptAt`, `leaseExpiresAt`, `createdAt`);
