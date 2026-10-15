-- KB-01B additive installation only, never part of enrollment DML.
CREATE TABLE initial_operator_enrollment (
 singleton tinyint unsigned NOT NULL,
 contract_version tinyint unsigned NOT NULL,
 operation_id varchar(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 organisation_id int unsigned NULL,
 domain varchar(253) CHARACTER SET ascii COLLATE ascii_bin NULL,
 uid varchar(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
 username varchar(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
 email varchar(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 identity_commitment char(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 credential_commitment char(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 PRIMARY KEY (singleton), UNIQUE KEY operation_id (operation_id), UNIQUE KEY uid (uid),
 CONSTRAINT initial_operator_singleton CHECK (singleton=1),
 CONSTRAINT initial_operator_version CHECK (contract_version=1)
) ENGINE=InnoDB;
