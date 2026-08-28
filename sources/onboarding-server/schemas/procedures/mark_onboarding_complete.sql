-- File: onboarding-server/shcemas/procedures/mark_onboarding_complete.sql

DROP PROCEDURE IF EXISTS `mark_onboarding_complete`;

DELIMITER $$

CREATE PROCEDURE `mark_onboarding_complete`(
    IN _session_id VARCHAR(128) CHARACTER SET ascii
)
BEGIN
    -- Added semicolons
    DECLARE v_firstname VARCHAR(128);
    DECLARE v_lastname VARCHAR(128);
    DECLARE v_email VARCHAR(255);
    DECLARE v_country_code CHAR(2); 
    DECLARE v_usage_plan VARCHAR(20); 
    DECLARE v_current_tools JSON;     
    DECLARE v_tools_count INT;       
    DECLARE v_privacy INT;           

    -- Validate input
    IF _session_id IS NULL OR _session_id = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_id is required';
    END IF;

    -- Check if record exists
    IF NOT EXISTS (SELECT 1 FROM onboarding_responses WHERE session_id = _session_id) THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User onboarding not found. Please start from Step 1.';
    END IF;

    -- Get current values
    SELECT
        firstname, lastname, email, country_code, 
        usage_plan, current_tools, JSON_LENGTH(current_tools), privacy_concern_level
    INTO
        v_firstname, v_lastname, v_email, v_country_code, 
        v_usage_plan, v_current_tools, v_tools_count, v_privacy
    FROM onboarding_responses
    WHERE session_id = _session_id; 
    -- Validate: Check if user actually filled in data
    IF v_firstname IS NULL OR v_lastname IS NULL OR v_email IS NULL OR v_country_code IS NULL THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Step 1 is incomplete.';
    END IF;
    IF v_usage_plan IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Step 2 (Usage Plan) is incomplete.';
    END IF;
    -- Check current_tools is not the default empty array '[]'
    IF v_current_tools IS NULL OR v_tools_count = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Step 3 (Tools) is incomplete or empty.';
    END IF;
    IF v_privacy IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Step 4 (Privacy) is incomplete.';
    END IF;

    -- If all validations pass, return the complete record
    SELECT
        session_id,
        TRUE as is_completed,
        'completed' as status,
        firstname,
        lastname,
        email,
        country_code,
        usage_plan,
        current_tools,
        privacy_concern_level,
        ctime,
        mtime
    FROM onboarding_responses
    WHERE session_id = _session_id; 

END$$

DELIMITER ;