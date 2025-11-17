-- File: onboarding-server/schemas/procedures/get_onboarding_response.sql

DROP PROCEDURE IF EXISTS `get_onboarding_response`;

DELIMITER $$

CREATE PROCEDURE `get_onboarding_response`(
    IN _session_id VARCHAR(128) CHARACTER SET ascii
)
BEGIN
    -- Validate input
    IF _session_id IS NULL OR _session_id = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_id is required';
    END IF;

    -- Get onboarding response
    SELECT
        id,
        session_id, 
        firstname,
        lastname,
        email,
        country_code, 
        usage_plan,
        usage_plan plan,
        current_tools,
        current_tools tools,
        privacy_concern_level,
        privacy_concern_level privacy,
        ctime,
        mtime
    FROM onboarding_responses
    WHERE session_id = _session_id; 

END$$

DELIMITER ;