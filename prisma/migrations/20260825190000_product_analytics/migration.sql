CREATE TABLE `analytics_events` (
    `id` VARCHAR(64) NOT NULL,
    `tenantId` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NULL,
    `sessionId` VARCHAR(64) NULL,
    `eventName` VARCHAR(64) NOT NULL,
    `pagePath` VARCHAR(500) NULL,
    `durationMs` INTEGER NULL,
    `properties` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `analytics_events_tenantId_eventName_occurredAt_idx`(`tenantId`, `eventName`, `occurredAt`),
    INDEX `analytics_events_projectId_occurredAt_idx`(`projectId`, `occurredAt`),
    INDEX `analytics_events_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `analytics_events_sessionId_occurredAt_idx`(`sessionId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
