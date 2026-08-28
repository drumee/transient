-- File: onboarding-server/sql/procedures/get_countries.sql
DROP PROCEDURE IF EXISTS `get_countries`;

DELIMITER $$

CREATE PROCEDURE `get_countries`(
    IN _locale_code VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
  SELECT 
    country_code, 
    locale_code, 
    locale_name 
  FROM countries
  ORDER BY locale_name ASC; 
END$$

DELIMITER ;