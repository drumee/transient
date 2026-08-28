-- File: onboarding-server/schemas/tables/signup_data.sql

DROP TABLE IF EXISTS signup_data;

CREATE TABLE IF NOT EXISTS signup_data (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    -- Metadata
    ctime INT(11) UNSIGNED,
    mtime INT(11) UNSIGNED,
    session_id VARCHAR(128) NOT NULL COMMENT 'Unique session identifier',
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    -- Constraints
    UNIQUE KEY uni_session_id (session_id),
    UNIQUE KEY email (email)

) ENGINE=InnoDB DEFAULT CHARSET=ascii COLLATE=ascii_general_ci
COMMENT='Signup data';