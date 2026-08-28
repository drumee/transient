-- File: loby/schemas/procedures/save_onboarding_usage_plan.sql
DROP PROCEDURE IF EXISTS `save_onboarding_usage_plan`;
DELIMITER $$
CREATE PROCEDURE `save_onboarding_usage_plan`(
  IN _session_id VARCHAR(128) CHARACTER SET ascii,
  IN _usage_plan VARCHAR(32)
)
BEGIN
  -- Validate session_id
  IF _session_id IS NULL OR _session_id = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_id is required';
  END IF;

  -- Validate usage_plan value
  IF _usage_plan NOT IN ('personal', 'startup', 'enterprise') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid usage plan. Must be one of: personal, startup, enterprise';
  END IF;

  -- JSON_QUOTE converts plain string to valid JSON string: personal → "personal"
  UPDATE onboarding_responses
  SET
    usage_plan = JSON_QUOTE(_usage_plan),
    mtime      = UNIX_TIMESTAMP()
  WHERE session_id = _session_id;
END$$
DELIMITER ;