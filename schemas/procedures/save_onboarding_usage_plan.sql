-- File: onboarding-server/schemas/procedures/save_onboarding_usage_plan.sql

DROP PROCEDURE IF EXISTS `save_onboarding_usage_plan`;

DELIMITER $$

CREATE PROCEDURE `save_onboarding_usage_plan`(
    IN _session_id VARCHAR(128) CHARACTER SET ascii,
    IN _usage_plan JSON
)
BEGIN
    -- Validate inputs
    IF _session_id IS NULL OR _session_id = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_id is required';
    END IF;
    IF _usage_plan IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'usage_plan is required';
    END IF;

    -- Update usage plan (WHERE clause ensures record exists)
    UPDATE onboarding_responses
    SET
        usage_plan = _usage_plan,
        mtime = UNIX_TIMESTAMP()
    WHERE session_id = _session_id; 

END$$

DELIMITER ;