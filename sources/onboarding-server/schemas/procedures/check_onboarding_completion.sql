-- File: onboarding-server/schemas/procedures/check_onboarding_completion.sql

DROP PROCEDURE IF EXISTS `check_onboarding_completion`;

DELIMITER $$

CREATE PROCEDURE `check_onboarding_completion`(
    IN _session_id VARCHAR(128) CHARACTER SET ascii
)
BEGIN
    DECLARE v_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_usage_plan VARCHAR(20);
    DECLARE v_tools_count INT DEFAULT 0;
    DECLARE v_privacy INT;
    DECLARE v_completed BOOLEAN DEFAULT FALSE;

    -- Validate input
    IF _session_id IS NULL OR _session_id = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_id is required';
    END IF;

    -- Check if record exists
    SELECT COUNT(*) > 0 INTO v_exists
    FROM onboarding_responses
    WHERE session_id = _session_id; 

    IF NOT v_exists THEN
        -- Not started - return early
        SELECT
            _session_id as session_id, 
            FALSE as is_completed,
            'not_started' as status,
            NULL as steps_completed;
    ELSE
        -- Record exists - check completion
        SELECT
            usage_plan,
            JSON_LENGTH(current_tools),
            privacy_concern_level
        INTO v_usage_plan, v_tools_count, v_privacy
        FROM onboarding_responses
        WHERE session_id = _session_id; 

        -- Completion is defined as having selected tools (not the default empty array)
        SET v_completed = (v_tools_count > 0);

        SELECT
            _session_id as session_id,
            v_completed as is_completed,
            CASE
                WHEN v_completed THEN 'completed'
                ELSE 'incomplete'
            END as status,
            JSON_OBJECT(
                'step1_user_info', (SELECT firstname IS NOT NULL FROM onboarding_responses WHERE session_id = _session_id), 
                'step2_usage_plan', (v_usage_plan IS NOT NULL),
                'step3_tools', (v_tools_count > 0),
                'step4_privacy', (v_privacy IS NOT NULL)
            ) as steps_completed;
    END IF;

END$$

DELIMITER ;