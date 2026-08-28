
DELIMITER $

DROP PROCEDURE IF EXISTS `pickup_domain`$
CREATE PROCEDURE `pickup_domain`(
)
BEGIN
  DECLARE _planet_id INTEGER DEFAULT 1;
  DECLARE _color_id INTEGER DEFAULT 0;
  DECLARE _color VARCHAR(500)  CHARACTER SET ascii DEFAULT 'blue';
  DECLARE _domain VARCHAR(500)  CHARACTER SET ascii;
  DECLARE _ident VARCHAR(500)  CHARACTER SET ascii;
  DECLARE _exists INTEGER DEFAULT 0;

  SELECT MAX(ID) FROM planet INTO _planet_id;
  SELECT FLOOR(1 + rand()*_planet_id) INTO _planet_id;
  SELECT CONCAT('.', yp.main_domain()) INTO _domain;

  SELECT count(*) FROM planet p INNER JOIN 
    yp.vhost v ON CONCAT(p.name, _domain) = v.fqdn
    WHERE p.id=_planet_id 
    INTO _exists;

  WHILE _exists DO
    SELECT MAX(ID) FROM planet INTO _planet_id;
    SELECT FLOOR(1 + rand()*_planet_id) INTO _planet_id;
    SELECT MAX(ID) FROM color INTO _color_id;
    SELECT FLOOR(1 + rand()*_color_id) INTO _color_id;
    SELECT `name` FROM color WHERE id=_color_id INTO _color;
    SELECT count(*) FROM planet p INNER JOIN 
      yp.vhost v ON CONCAT(_color, '-', p.name, _domain) = v.fqdn
      WHERE p.id=_planet_id 
    INTO _exists;
  END WHILE; 

  IF NOT _color_id THEN
    SELECT `name`, CONCAT(`name`, _domain) FROM planet WHERE id = _planet_id INTO _ident, _domain;
  ELSE
    SELECT `name`, CONCAT(`name`, _domain) FROM planet WHERE id = _planet_id INTO _ident, _domain;
    SELECT `name`, CONCAT(`name`, '-', _domain) FROM color WHERE id = _color_id INTO _ident, _domain;
  END IF;

  SELECT _ident ident, _domain `name`;
END$


DELIMITER ;
