const { Mariadb, Logger, Cache } = require("@drumee/server-essentials");

class Sandbox extends Logger {
  /**
    * 
    * @param {*} opt 
    */
  initialize(opt = {}) {
    if (!this.yp) {
      this.yp = opt.yp || new Mariadb({ name: "yp" });
    }
  }


  /**
   * 
   */
  async end(terminate = 0) {
    if (this.db) {
      await this.db.stop();
    }
  }


  /**
   * 
   */
  async iniFolders(user = {}, folders) {
    const { db_name } = user;
    if (!db_name) {
      console.error("Require db_name");
      return;
    }
    if (!folders) {
      folders = [];
      for (let dir of ["_photos", "_documents", "_videos", "_musics"]) {
        folders.push({ path: Cache.message(dir) });
      }
    }
    //this.debug("INIT FOLDERS ", folders);
    await this.yp.await_proc(
      `${db_name}.mfs_init_folders`,
      folders,
      0
    );
  }

}
module.exports = Sandbox;