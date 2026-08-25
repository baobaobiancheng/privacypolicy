-- Core v2 baseline. Development databases using the legacy demo schema must
-- be explicitly reset before applying this baseline; deployment never resets
-- a database automatically.
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `tenantId` VARCHAR(64) NOT NULL,
    `email` VARCHAR(255) NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `role` ENUM('CLIENT_EDITOR', 'PRODUCT_TECH', 'ADMIN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `users_tenantId_role_idx`(`tenantId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `projects` (
    `id` VARCHAR(64) NOT NULL,
    `tenantId` VARCHAR(64) NOT NULL,
    `ownerId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `productName` VARCHAR(160) NULL,
    `status` ENUM('INFORMATION_COLLECTING', 'ACTIVE', 'STOPPED') NOT NULL DEFAULT 'INFORMATION_COLLECTING',
    `revision` INTEGER NOT NULL DEFAULT 0,
    `formSchemaVersion` VARCHAR(64) NOT NULL DEFAULT 'privacy-form-v2.0.0',
    `contentVersion` VARCHAR(64) NOT NULL,
    `contentHash` CHAR(71) NOT NULL,
    `categoryKey` VARCHAR(64) NOT NULL DEFAULT 'map-navigation',
    `categoryVersion` VARCHAR(64) NOT NULL DEFAULT 'app-categories-v1.0.0',
    `currentStepKey` VARCHAR(64) NOT NULL DEFAULT 'profile',
    `formData` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `projects_tenantId_status_updatedAt_idx`(`tenantId`, `status`, `updatedAt`),
    INDEX `projects_ownerId_updatedAt_idx`(`ownerId`, `updatedAt`),
    INDEX `projects_tenantId_categoryKey_idx`(`tenantId`, `categoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_access` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `role` ENUM('CLIENT_EDITOR', 'PRODUCT_TECH', 'ADMIN') NOT NULL,
    `grantedBy` VARCHAR(64) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `project_access_userId_projectId_idx`(`userId`, `projectId`),
    UNIQUE INDEX `project_access_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `generation_jobs` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `requestedById` VARCHAR(64) NOT NULL,
    `projectRevision` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(128) NOT NULL,
    `inputHash` CHAR(71) NOT NULL,
    `inputJson` JSON NOT NULL,
    `state` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED') NOT NULL DEFAULT 'QUEUED',
    `stage` ENUM('QUEUED', 'FACT_CHECK', 'LAW_SEARCH', 'DRAFTING', 'FINALIZING', 'COMPLETED') NOT NULL DEFAULT 'QUEUED',
    `progressJson` JSON NULL,
    `previewMarkdown` LONGTEXT NULL,
    `errorCode` VARCHAR(80) NULL,
    `errorMessage` TEXT NULL,
    `errorDetails` JSON NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `leaseOwner` VARCHAR(128) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `heartbeatAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `generation_jobs_state_leaseExpiresAt_createdAt_idx`(`state`, `leaseExpiresAt`, `createdAt`),
    INDEX `generation_jobs_projectId_createdAt_idx`(`projectId`, `createdAt`),
    UNIQUE INDEX `generation_jobs_projectId_idempotencyKey_key`(`projectId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reports` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `generationId` VARCHAR(64) NOT NULL,
    `projectRevision` INTEGER NOT NULL,
    `inputHash` CHAR(71) NOT NULL,
    `state` ENUM('CURRENT', 'SUPERSEDED') NOT NULL DEFAULT 'CURRENT',
    `filename` VARCHAR(255) NOT NULL,
    `markdown` LONGTEXT NOT NULL,
    `storageKind` ENUM('MYSQL', 'OBJECT_STORAGE') NOT NULL DEFAULT 'MYSQL',
    `storageKey` VARCHAR(512) NULL,
    `docx` LONGBLOB NULL,
    `docxHash` CHAR(71) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `reports_generationId_key`(`generationId`),
    INDEX `reports_projectId_state_createdAt_idx`(`projectId`, `state`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_events` (
    `id` VARCHAR(64) NOT NULL,
    `requestId` VARCHAR(64) NULL,
    `projectId` VARCHAR(64) NULL,
    `userId` VARCHAR(64) NULL,
    `action` VARCHAR(120) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `audit_events_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `audit_events_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `project_access` ADD CONSTRAINT `project_access_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `project_access` ADD CONSTRAINT `project_access_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `generation_jobs` ADD CONSTRAINT `generation_jobs_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `generation_jobs` ADD CONSTRAINT `generation_jobs_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `reports` ADD CONSTRAINT `reports_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `reports` ADD CONSTRAINT `reports_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `generation_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
