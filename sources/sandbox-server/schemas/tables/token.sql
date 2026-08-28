DROP TABLE IF EXISTS `token`;
CREATE TABLE `token` (
  `id` VARCHAR(64)  CHARACTER SET ascii,
  `uid` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci GENERATED ALWAYS AS (json_value(`value`,'$.uid')) VIRTUAL,
  `username` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci GENERATED ALWAYS AS (json_value(`value`,'$.username')) VIRTUAL,
  `domain` varchar(128) CHARACTER SET ascii COLLATE ascii_general_ci GENERATED ALWAYS AS (json_value(`value`,'$.domain')) VIRTUAL,
  `value` JSON,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
