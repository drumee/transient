DROP TABLE IF EXISTS user;
CREATE TABLE `user` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `firstname` varchar(1000) DEFAULT "",
  `lastname` varchar(1000) DEFAULT "",
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`firstname`, `lastname`) USING HASH
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
