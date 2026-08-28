DROP TABLE IF EXISTS email;
CREATE TABLE `email` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `email` varchar(200) DEFAULT "",
  `headers` JSON,
  `ctime` INT(11) UNSIGNED,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=ascii;
