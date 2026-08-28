
DELIMITER $

DROP PROCEDURE IF EXISTS `token_store`$
CREATE PROCEDURE `token_store`(
  IN _id VARCHAR(90)  CHARACTER SET ascii,
  IN _value JSON
)
BEGIN
  INSERT IGNORE INTO token (`id`, `value`) VALUES(_id, _value);
END$

DELIMITER ;
