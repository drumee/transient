const {
  Mariadb,
  Cache,
  redisStore,
  Logger,
  Offline,
} = require("@drumee/server-essentials");


new Mariadb({ name: 'yp', user:process.env.USER, idleTimeout: 60 });
new Cache();
new redisStore();
new Logger();
new Offline();