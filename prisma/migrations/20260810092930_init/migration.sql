-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `tenantId` VARCHAR(64) NOT NULL,
    `email` VARCHAR(255) NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `role` ENUM('CLIENT_EDITOR', 'PRODUCT_TECH', 'LAWYER_REVIEWER', 'ADMIN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `users_tenantId_role_idx`(`tenantId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(64) NOT NULL,
    `tenantId` VARCHAR(64) NOT NULL,
    `ownerId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `productName` VARCHAR(160) NULL,
    `status` ENUM('INFORMATION_COLLECTING', 'REVIEW_PENDING', 'READY_TO_EXPORT', 'EXPORTING', 'EXPORTED', 'STOPPED') NOT NULL DEFAULT 'INFORMATION_COLLECTING',
    `revision` INTEGER NOT NULL DEFAULT 0,
    `contentVersion` VARCHAR(64) NOT NULL,
    `contentHash` CHAR(71) NOT NULL,
    `formData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `projects_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `projects_ownerId_updatedAt_idx`(`ownerId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_access` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `role` ENUM('CLIENT_EDITOR', 'PRODUCT_TECH', 'LAWYER_REVIEWER', 'ADMIN') NOT NULL,
    `grantedBy` VARCHAR(64) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_access_userId_projectId_idx`(`userId`, `projectId`),
    UNIQUE INDEX `project_access_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `processing_activities` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `featureKey` VARCHAR(64) NOT NULL,
    `featureContentHash` CHAR(71) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `status` ENUM('SELECTED', 'CANDIDATE', 'EXCLUDED') NOT NULL DEFAULT 'CANDIDATE',
    `purpose` TEXT NULL,
    `lawfulBasis` VARCHAR(120) NULL,
    `retentionPeriod` VARCHAR(120) NULL,
    `riskCode` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `processing_activities_projectId_status_idx`(`projectId`, `status`),
    UNIQUE INDEX `processing_activities_projectId_featureKey_key`(`projectId`, `featureKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fact_assertions` (
    `id` VARCHAR(160) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `activityId` VARCHAR(64) NULL,
    `recipientId` VARCHAR(64) NULL,
    `subjectKey` VARCHAR(160) NOT NULL,
    `groupKey` VARCHAR(120) NOT NULL,
    `fieldKey` VARCHAR(120) NOT NULL,
    `value` JSON NOT NULL,
    `valueVersion` INTEGER NOT NULL DEFAULT 1,
    `originType` ENUM('REGULATION', 'EXPERT_CONTENT', 'REFERENCE_POLICY', 'AI_INFERRED', 'CLIENT_ORIGINAL') NOT NULL,
    `factVerification` ENUM('UNCONFIRMED', 'CLIENT_CONFIRMED', 'LAWYER_CONFIRMED', 'EXCLUDED', 'CONFLICT') NOT NULL DEFAULT 'UNCONFIRMED',
    `legalReview` ENUM('NOT_REQUIRED', 'PENDING', 'LAWYER_REVIEWED', 'NEEDS_CHANGE') NOT NULL DEFAULT 'PENDING',
    `current` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fact_assertions_projectId_subjectKey_groupKey_fieldKey_idx`(`projectId`, `subjectKey`, `groupKey`, `fieldKey`),
    INDEX `fact_assertions_projectId_activityId_current_idx`(`projectId`, `activityId`, `current`),
    INDEX `fact_assertions_projectId_recipientId_current_idx`(`projectId`, `recipientId`, `current`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `processing_recipients` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `activityId` VARCHAR(64) NOT NULL,
    `recipientKey` VARCHAR(120) NOT NULL,
    `kind` ENUM('THIRD_PARTY', 'SDK', 'PROCESSOR') NOT NULL,
    `role` ENUM('PROCESSOR', 'SHARED_WITH', 'SDK_PROVIDER') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `privacyUrl` VARCHAR(512) NULL,
    `fields` JSON NULL,

    INDEX `processing_recipients_activityId_kind_idx`(`activityId`, `kind`),
    UNIQUE INDEX `processing_recipients_projectId_activityId_recipientKey_role_key`(`projectId`, `activityId`, `recipientKey`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evidence` (
    `id` VARCHAR(120) NOT NULL,
    `projectId` VARCHAR(64) NULL,
    `kind` VARCHAR(48) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `summary` TEXT NOT NULL,
    `url` VARCHAR(512) NULL,
    `contentHash` CHAR(71) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `evidence_projectId_kind_idx`(`projectId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provenance_links` (
    `id` VARCHAR(64) NOT NULL,
    `assertionId` VARCHAR(64) NOT NULL,
    `evidenceId` VARCHAR(120) NOT NULL,
    `originType` ENUM('REGULATION', 'EXPERT_CONTENT', 'REFERENCE_POLICY', 'AI_INFERRED', 'CLIENT_ORIGINAL') NOT NULL,
    `note` TEXT NULL,

    INDEX `provenance_links_evidenceId_idx`(`evidenceId`),
    UNIQUE INDEX `provenance_links_assertionId_evidenceId_originType_key`(`assertionId`, `evidenceId`, `originType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `confirmations` (
    `id` VARCHAR(64) NOT NULL,
    `assertionId` VARCHAR(64) NOT NULL,
    `valueVersion` INTEGER NOT NULL,
    `confirmerId` VARCHAR(64) NOT NULL,
    `result` ENUM('CONFIRMED', 'EXCLUDED', 'REJECTED') NOT NULL,
    `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `invalidatedAt` DATETIME(3) NULL,

    INDEX `confirmations_confirmerId_confirmedAt_idx`(`confirmerId`, `confirmedAt`),
    UNIQUE INDEX `confirmations_assertionId_valueVersion_confirmerId_result_key`(`assertionId`, `valueVersion`, `confirmerId`, `result`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `activityId` VARCHAR(64) NULL,
    `recipientId` VARCHAR(64) NULL,
    `targetRole` ENUM('CLIENT_EDITOR', 'PRODUCT_TECH', 'LAWYER_REVIEWER', 'ADMIN') NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `title` VARCHAR(255) NOT NULL,
    `details` TEXT NULL,
    `dueAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tasks_projectId_status_targetRole_idx`(`projectId`, `status`, `targetRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `draft_snapshots` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `projectRevision` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(120) NOT NULL,
    `templateHash` CHAR(71) NOT NULL,
    `contentVersion` VARCHAR(64) NOT NULL,
    `inputHash` CHAR(71) NOT NULL,
    `state` ENUM('PENDING', 'GENERATING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `markdown` LONGTEXT NULL,
    `docx` LONGBLOB NULL,
    `docxHash` CHAR(71) NULL,
    `failureCode` VARCHAR(80) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `draft_snapshots_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `draft_snapshots_state_leaseExpiresAt_idx`(`state`, `leaseExpiresAt`),
    UNIQUE INDEX `draft_snapshots_projectId_idempotencyKey_key`(`projectId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_events` (
    `id` VARCHAR(160) NOT NULL,
    `commandId` VARCHAR(120) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `audit_events_commandId_key`(`commandId`),
    INDEX `audit_events_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_access` ADD CONSTRAINT `project_access_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_access` ADD CONSTRAINT `project_access_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processing_activities` ADD CONSTRAINT `processing_activities_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fact_assertions` ADD CONSTRAINT `fact_assertions_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fact_assertions` ADD CONSTRAINT `fact_assertions_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `processing_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fact_assertions` ADD CONSTRAINT `fact_assertions_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `processing_recipients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processing_recipients` ADD CONSTRAINT `processing_recipients_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processing_recipients` ADD CONSTRAINT `processing_recipients_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `processing_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provenance_links` ADD CONSTRAINT `provenance_links_assertionId_fkey` FOREIGN KEY (`assertionId`) REFERENCES `fact_assertions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provenance_links` ADD CONSTRAINT `provenance_links_evidenceId_fkey` FOREIGN KEY (`evidenceId`) REFERENCES `evidence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `confirmations` ADD CONSTRAINT `confirmations_assertionId_fkey` FOREIGN KEY (`assertionId`) REFERENCES `fact_assertions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `confirmations` ADD CONSTRAINT `confirmations_confirmerId_fkey` FOREIGN KEY (`confirmerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `processing_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `processing_recipients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `draft_snapshots` ADD CONSTRAINT `draft_snapshots_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
