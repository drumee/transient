-- Migration: onboarding_responses v1 → v2
--
-- The v1 table (from onboarding-server) used first_name/last_name with NOT NULL
-- constraints and an ENUM usage_plan NOT NULL. The v2 wizard (loby) renamed the
-- name columns, relaxed all optional fields to NULL, and added industry/role/
-- team_size/intent/challenges/challenge_note.
--
-- Safe to run multiple times: uses CHANGE COLUMN IF EXISTS / ADD COLUMN IF NOT EXISTS.

ALTER TABLE `onboarding_responses`
  -- Rename v1 field names
  CHANGE COLUMN IF EXISTS `first_name`  `firstname` VARCHAR(128) NOT NULL,
  CHANGE COLUMN IF EXISTS `last_name`   `lastname`  VARCHAR(128) NULL,

  -- Relax NOT NULL on optional signup-carry-over fields
  MODIFY COLUMN IF EXISTS `email`        VARCHAR(255) NULL,
  MODIFY COLUMN IF EXISTS `country_code` CHAR(2)      NULL,

  -- v1 usage_plan was ENUM NOT NULL — convert to JSON NULL to match the v2
  -- table definition and preserve any legacy ENUM values already stored
  MODIFY COLUMN IF EXISTS `usage_plan` JSON NULL
    COMMENT 'v1: personal | startup | enterprise (stored as JSON-quoted string)',

  -- v1 current_tools and privacy_concern_level were NOT NULL
  MODIFY COLUMN IF EXISTS `current_tools`         JSON          NULL DEFAULT NULL,
  MODIFY COLUMN IF EXISTS `privacy_concern_level` TINYINT UNSIGNED NULL
    COMMENT 'v1 only: 1..5',

  -- New v2 columns
  ADD COLUMN IF NOT EXISTS `industry` VARCHAR(32) NULL AFTER `country_code`
    COMMENT 'tech_software | creative_marketing | consulting_agency | legal_compliance | finance_accounting | healthcare | education | real_estate | ecommerce_retail | media_content | operations | other',
  ADD COLUMN IF NOT EXISTS `role` VARCHAR(32) NULL AFTER `industry`
    COMMENT 'founder_ceo | manager_team_lead | executive_associate | freelancer_consultant | other',
  ADD COLUMN IF NOT EXISTS `team_size` ENUM('just_me','2_10','10_50','50_plus') NULL AFTER `role`,
  ADD COLUMN IF NOT EXISTS `intent` VARCHAR(32) NULL AFTER `team_size`
    COMMENT 'manage_projects | work_with_clients | store_sensitive | build_workflows | personal_files',
  ADD COLUMN IF NOT EXISTS `challenges`     JSON          NULL AFTER `current_tools`
    COMMENT 'Array of pain-point keys selected on the tools step',
  ADD COLUMN IF NOT EXISTS `challenge_note` VARCHAR(1024) NULL AFTER `challenges`
    COMMENT 'Free-text tell me more note';
