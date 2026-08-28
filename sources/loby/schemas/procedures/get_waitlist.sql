DROP PROCEDURE IF EXISTS `get_waitlist`;

DELIMITER $$

CREATE PROCEDURE `get_waitlist`(
    
)
BEGIN
  SELECT
    ctime,
    firstname,
    lastname,
    email,
    privacy_concern_level privacy, 
    current_tools tools,
    usage_plan plan,
    locale_name country 
  FROM onboarding_responses o
    INNER JOIN countries USING(country_code)
  ORDER BY ctime DESC;
END$$

DELIMITER ;

