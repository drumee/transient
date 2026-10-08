DELIMITER $
DROP PROCEDURE IF EXISTS `phase48b_installed_marker_read`$
CREATE PROCEDURE `phase48b_installed_marker_read`(IN _marker_key VARCHAR(64))
SQL SECURITY INVOKER
BEGIN
  SELECT marker_key, marker_value FROM phase48b_installed_marker WHERE marker_key=_marker_key;
END$
DELIMITER ;
