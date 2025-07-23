
DELIMITER $

DROP PROCEDURE IF EXISTS `store_email`$
CREATE PROCEDURE `store_email`(
  IN _email VARCHAR(200)  CHARACTER SET ascii,
  IN _headers JSON
)
BEGIN
  INSERT INTO email (`email`, `headers`, `ctime`) VALUES(_email, _headers, UNIX_TIMESTAMP());
END$

DELIMITER ;
