
DELIMITER $

DROP PROCEDURE IF EXISTS `domain_users`$
CREATE PROCEDURE `domain_users`(
  IN _domain VARCHAR(90)  CHARACTER SET ascii
)
BEGIN
  SELECT 
    p.privilege, 
    IF(p.privilege = 63, "ADMIN", "USER") `role`,
    t.id token, 
    p.uid id, 
    p.uid, 
    t.username, 
    domain, 
    fqdn host
    FROM token t
    INNER JOIN yp.drumate d ON d.id=t.uid
    INNER JOIN yp.vhost v ON v.id=t.uid
    INNER JOIN yp.privilege p ON p.uid=d.id
  WHERE t.domain=_domain;
END$

DELIMITER ;
