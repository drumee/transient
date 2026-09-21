-- Phase 4.6A platform-bootstrap ownership: the default organisation registry.
-- Provenance: schemas/yellow_page/tables/organisation.sql at
-- cb838e255600a4ec3797dc7ac13659ad9d187421. The table shape is retained so
-- later compatibility work does not require a second organisation model.
-- No Hub, MFS, storage, deployment or Team object is included.
CREATE TABLE IF NOT EXISTS `organisation` (
  `sys_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `domain_id` int(11) NOT NULL,
  `name` varchar(512) DEFAULT NULL,
  `link` varchar(1024) DEFAULT NULL,
  `ident` varchar(80) DEFAULT NULL,
  `password_level` int(4) DEFAULT 1,
  `dir_visibility` varchar(40) DEFAULT 'all',
  `dir_info` varchar(40) DEFAULT 'all',
  `double_auth` int(1) DEFAULT 0,
  `usb_auth` int(1) DEFAULT 0,
  `owner_id` varchar(16) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  PRIMARY KEY (`sys_id`),
  UNIQUE KEY `domain_id` (`domain_id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `owner_id` (`owner_id`),
  UNIQUE KEY `ident` (`ident`,`domain_id`),
  UNIQUE KEY `link` (`link`) USING HASH
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
