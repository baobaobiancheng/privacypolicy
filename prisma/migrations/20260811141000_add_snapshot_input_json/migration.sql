ALTER TABLE `draft_snapshots`
  ADD COLUMN `inputJson` JSON NULL AFTER `inputHash`;
