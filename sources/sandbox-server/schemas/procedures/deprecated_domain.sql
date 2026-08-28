
DELIMITER $

DROP PROCEDURE IF EXISTS `deprecated_domain`$
CREATE PROCEDURE `deprecated_domain`(
  IN _delay INT(11)
)
BEGIN
  SELECT 
    fqdn,
    v.dom_id id,
    FROM_UNIXTIME(e.ctime) ctime
    FROM yp.vhost v INNER JOIN yp.entity e ON 
    v.id=e.id INNER JOIN yp.organisation o ON 
    v.dom_id=o.domain_id AND o.link=v.fqdn 
  WHERE JSON_VALUE(o.metadata, "$.category") ="sandbox" AND
    (UNIX_TIMESTAMP() - e.ctime) > _delay;
END$

DELIMITER ;
