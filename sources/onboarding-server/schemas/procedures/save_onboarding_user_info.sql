DROP PROCEDURE IF EXISTS `save_onboarding_user_info`;

DELIMITER $$

CREATE PROCEDURE `save_onboarding_user_info`(
    IN _session_id VARCHAR(128) CHARACTER SET ascii,
    IN _firstname VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN _lastname VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN _email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN _country_code CHAR(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
    -- (Giữ nguyên phần validation)
    
    IF _session_id IS NULL OR _session_id = '' THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'session_id is required'; 
    END IF;
    
    IF _firstname IS NULL OR _firstname = '' THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'firstname is required'; 
    END IF;
    
    IF _lastname IS NULL OR _lastname = '' THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'lastname is required'; 
    END IF;
    
    IF _email IS NULL OR _email = '' THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'email is required'; 
    END IF;
    
    IF _country_code IS NULL OR _country_code = '' OR LENGTH(_country_code) != 2 THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Valid 2-letter country_code is required'; 
    END IF;
    
    IF _email NOT REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid email format'; 
    END IF;

    IF NOT EXISTS (SELECT 1 FROM countries WHERE country_code = _country_code) THEN
       SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid country_code provided'; 
    END IF;

    INSERT INTO onboarding_responses (
        session_id,
        firstname,
        lastname,
        email,
        country_code,
        usage_plan,
        current_tools,
        ctime,
        mtime,
        privacy_concern_level
    )
    VALUES (
        _session_id,
        _firstname,
        _lastname,
        _email,
        _country_code,
        JSON_OBJECT(),
        JSON_OBJECT(),
        UNIX_TIMESTAMP(),
        UNIX_TIMESTAMP(),
        1
    )
    ON DUPLICATE KEY UPDATE
        firstname = VALUES(firstname),
        lastname = VALUES(lastname),
        email = VALUES(email),
        country_code = VALUES(country_code),
        mtime = UNIX_TIMESTAMP();

END$$

DELIMITER ;