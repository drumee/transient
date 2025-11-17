-- File: onboarding-server/schemas/tables/onboarding_responses.sql

DROP TABLE IF EXISTS onboarding_responses;

CREATE TABLE IF NOT EXISTS onboarding_responses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Unique session identifier',

    -- Step 1 Data (REQUIRED)
    firstname VARCHAR(128) NOT NULL,
    lastname VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    country_code CHAR(2) NOT NULL COMMENT 'Corresponds to countries.country_code',

    -- Step 2 Data (REQUIRED)
    usage_plan JSON NOT NULL
        COMMENT 'How user plans to use Drumee',

    -- Step 3 Data (REQUIRED)
    current_tools JSON NOT NULL
        COMMENT 'Array of tools: ["notion", "dropbox", "google_drive", "other"]',

    -- Step 4 Data (REQUIRED)
    privacy_concern_level TINYINT UNSIGNED NOT NULL
        COMMENT 'Scale: 1 (Not much) to 5 (Extremely important)',

    -- Metadata
    ctime INT(11) UNSIGNED,
    mtime INT(11) UNSIGNED,

    -- Indexes
    INDEX idx_session_id (session_id),
    INDEX idx_email (email),

    -- Constraints
    UNIQUE KEY uni_session_id (session_id),

    -- Validation Check
    CHECK (privacy_concern_level BETWEEN 1 AND 5)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Onboarding survey responses linked to session ID';