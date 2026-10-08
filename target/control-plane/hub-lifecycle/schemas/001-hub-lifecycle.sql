-- Phase 4.8B generic Hub lifecycle control-plane registry.
-- It stores only lifecycle, authorization and schema-plan metadata. Business
-- data remains in module-owned objects inside the assigned Hub shard.
CREATE TABLE IF NOT EXISTS `hub` (
  `id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `owner_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `domain_id` int(11) unsigned NOT NULL,
  `name` varchar(128) NOT NULL,
  `ctime` int(11) unsigned NOT NULL,
  `mtime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`id`), KEY `owner_id` (`owner_id`), KEY `domain_id` (`domain_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `hub_lifecycle` (
  `hub_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organisation_id` int(11) unsigned NOT NULL,
  `creator_uid` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `creator_module` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `inherit_policy` enum('installed','own') NOT NULL,
  `public_name` varchar(128) NOT NULL,
  `database_name` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `state` enum('allocating','provisioning','ready','failed','upgrading') NOT NULL,
  `error_code` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ctime` int(11) unsigned NOT NULL,
  `mtime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`hub_id`), UNIQUE KEY `database_name` (`database_name`),
  KEY `policy_state` (`inherit_policy`,`state`,`hub_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `hub_idempotency` (
  `organisation_id` int(11) unsigned NOT NULL,
  `creator_uid` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `creator_module` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `idempotency_key` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `request_fingerprint` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `hub_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ctime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`organisation_id`,`creator_uid`,`creator_module`,`idempotency_key`),
  UNIQUE KEY `hub_id` (`hub_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `hub_acl` (
  `hub_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `uid` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `permission` tinyint(3) unsigned NOT NULL,
  `granted_by` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ctime` int(11) unsigned NOT NULL,
  `mtime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`hub_id`,`uid`), KEY `uid` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `hub_plan` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hub_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `kind` enum('create','upgrade') NOT NULL,
  `plan_fingerprint` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`snapshot`)),
  `status` enum('pending','running','ready','failed') NOT NULL,
  `plan_cursor` int(11) unsigned NOT NULL DEFAULT 0,
  `error_code` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ctime` int(11) unsigned NOT NULL,
  `mtime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `hub_plan` (`hub_id`,`plan_fingerprint`),
  KEY `status_page` (`status`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `hub_capability` (
  `hub_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `module_id` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `plan_id` bigint unsigned NOT NULL,
  `target_version` varchar(128) NOT NULL,
  `applied_version` varchar(128) DEFAULT NULL,
  `artifact_ref` varchar(255) NOT NULL,
  `status` enum('provisioning','ready','failed') NOT NULL,
  `attempt` int(11) unsigned NOT NULL DEFAULT 0,
  `error_code` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `mtime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`hub_id`,`module_id`), KEY `plan_id` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `hub_schema_object` (
  `hub_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `object_key` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `module_id` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ctime` int(11) unsigned NOT NULL,
  PRIMARY KEY (`hub_id`,`object_key`), KEY `module_id` (`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
