DROP PROCEDURE IF EXISTS `get_signup_info`;

DELIMITER $$

CREATE PROCEDURE `get_signup_info`(
  IN _args JSON
)
BEGIN
  DECLARE _email TEXT;
  DECLARE _session_id TEXT;
  
  SELECT JSON_VALUE(_args, "$.email") INTO _email;
  SELECT JSON_VALUE(_args, "$.session_id") INTO _session_id;
  SELECT 
    otp, 
    email,
    JSON_OBJECT(
      'firstname', o.firstname,
      'lastname', o.lastname,
      'email', o.email,
      'country_code', o.country_code,
      'plan', o.usage_plan,
      'tools', o.current_tools,
      'privacy', o.privacy_concern_level
    ) user
  FROM signup_data s
    LEFT JOIN onboarding_responses o USING(email)
  WHERE 
    IF(_session_id IS NULL, 1, s.session_id=_session_id) AND
    IF(_email IS NULL, 1, s.email=_email)
  ORDER BY s.mtime DESC LIMIT 1;

END$$

DELIMITER ;