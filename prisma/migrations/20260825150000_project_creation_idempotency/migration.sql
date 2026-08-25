ALTER TABLE `projects`
  ADD COLUMN `creationKey` VARCHAR(128) NULL,
  ADD UNIQUE INDEX `projects_tenantId_ownerId_creationKey_key` (`tenantId`, `ownerId`, `creationKey`);
