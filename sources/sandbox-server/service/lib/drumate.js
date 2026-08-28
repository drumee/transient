const {
  Attr, uniqueId, Cache, toArray, sysEnv,
  RedisStore, Network
} = require("@drumee/server-essentials");
const { isEmpty } = require("lodash");
const { rmSync, copyFileSync, mkdirSync, existsSync } = require("fs");
const { mfs_dir, system_user, system_group } = sysEnv();
const { uniqueNamesGenerator, colors, animals, adjectives } = require('unique-names-generator');
const Mfs = require("./mfs");
const { resolve, extname, join } = require("path");
const { userInfo } = require("os");
const UID = userInfo().uid;
const { Generator } = require("@drumee/server-core");
const { exec } = require('shelljs');

const contentBase = `https://docs.drumee.com/sandbox`;
const AVATAR_DIR = `/srv/drumee/static/conf.d/sandbox/avatar`;

const hubNameConfig = {
  dictionaries: [adjectives, animals],
  length: 2,
  separator: ' ',
  style: 'capital'
}

const folderNameConfig = {
  dictionaries: [colors, animals],
  length: 2,
  separator: ' ',
  style: 'capital'
}

const Sandbox = require(".");
class Drumate extends Sandbox {

  /**
   * 
   * @param {*} opt 
   * @returns 
   */
  async removeHubs(opt) {
    let { db_name, id, name } = opt;
    console.log("removeHubs", db_name, id, name);
    if (!db_name) {
      console.log(`${name} doesn't have any hub`);
      return;
    }
    let hubs = await this.yp.await_proc(`${db_name}.show_hubs`);
    hubs = toArray(hubs) || [];
    let re = new RegExp(`^${mfs_dir}`);
    for (let hub of hubs) {
      if (hub.owner_id == id) {
        console.log(`DELETING CONTENT ${hub.name}...`);
        await this.yp.await_proc(`${hub.db_name}.remove_all_members`, 0);
        if (hub.home_dir && re.test(hub.home_dir)) {
          rmSync(hub.home_dir, { recursive: true, force: true });
        }
        await this.yp.await_proc(`drumate_vanish`, hub.id);
      } else {
        await this.yp.await_proc(`${db_name}.leave_hub`, hub.id);
      }
      this.trigger('progress');
    }
  }
  /**
  * 
  * @param {*} opt 
  */
  async remove(opt = {}) {
    let { email } = opt;
    email = email || this.get(Attr.email);
    let drumate = await this.yp.await_proc('get_user', email) || {};
    await this.removeHubs(drumate);
    if (drumate.id) {
      let sockets = await this.yp.await_proc('user_sockets', drumate.id);
      this.debug("Removing drumate", { email });
      let entity = await this.yp.await_proc("entity_delete", drumate.id);
      let re = new RegExp(`^${mfs_dir}`);
      this.trigger('progress');
      if (entity.home_dir && re.test(entity.home_dir)) {
        rmSync(entity.home_dir, { recursive: true, force: true });
      }
      await RedisStore.sendData(this.payload({
        uid: drumate.id,
        force_reload: 1,
      }, { service: "drumate.logout" }), sockets);
    }
  }

  /***
 * 
 */
  async create(opt) {
    let { domain, privilege } = opt;
    let password = uniqueId();
    let sql = `SELECT * FROM sandbox.user ORDER BY RAND() LIMIT 1`;
    let { firstname, lastname, avatar } = await this.yp.await_query(sql);
    firstname = firstname.trim();
    lastname = lastname.trim();
    let username = firstname;
    if (lastname) {
      username = username + "." + lastname[0]
    }
    username = username.replace(/[ \']+/g, "");
    username = username.replace(/[é]/g, "e");
    let email = `${username}@${domain}`.toLowerCase();
    const profile = {
      email,
      firstname,
      lastname,
      lang: "en", //this.input.ua_language(),
      privilege,
      domain,
      username,
      sharebox: uniqueId(),
      otp: 0,
      category: "sandox",
      profile_type: "sandbox",
    };
    this.trigger('progress');
    this.set({ email });
    let rows = await this.yp.await_proc("drumate_create", password, profile);
    let failed = 0;
    let drumate = null;
    for (let r of rows) {
      if (r && r.failed) {
        failed = 1;
      }
      if (r.drumate) {
        drumate = r.drumate;
      }
    }

    if (failed) {
      console.log(rows);
      console.error("Failed to create user", username);
      await this.remove({ email });
      return;
    }
    drumate.firstname = firstname;
    drumate.lastname = lastname;
    const quota = Cache.getSysConf("sandbox_quota");
    await this.yp.await_proc("drumate_update_profile", drumate.id, { quota });
    await this.iniFolders(drumate);

    const { db_name, id: uid } = drumate;
    const mfs = new Mfs({ db_name, yp: this.yp });
    await mfs.importFolder({ dirname: "/sandbox/desk" });

    // let sql = `SELECT * FROM sandbox.asset WHERE name=?`;
    // let symlinks = await this.yp.await_query(sql, 'symlinks');
    // this.debug("AAA:198", { symlinks, drumate });
    await mfs.importSymlinks(uid);
    let credentials = { email, username, password, uid, domain };
    this.set({ ...drumate, email, avatar, credentials });
    let token = uniqueId();
    await this.yp.await_proc("sandbox.token_store", token, credentials);
    await this.setupAvatar();
    await this.setWallpaper();
  }

  /**
   * 
   */
  async getWallpapers() {
    let wallpapers = Cache.getEnv('wallpapers');
    if (wallpapers) {
      return wallpapers
    }
    let conf = JSON.parse(Cache.getSysConf("wallpaper"));
    const { path: dirname, vhost: host } = conf;
    if (!host || !dirname) {
      this.warn("No wallpapers available found in sys conf");
      return;
    }
    let origin = `https://${host}`;
    const data = await Network.request(`${origin}/-/svc/media.manifest?nid=${dirname}`)
    Cache.setEnv('wallpapers', data[0])
    return data[0];
  }

  /**
   * 
   */
  async setWallpaper() {
    let wallpapers = await this.getWallpapers();
    if (!wallpapers) {
      this.warn("No wallpapers available");
      return;
    }
    let index = Math.floor(Math.random() * wallpapers.length);
    let uid = this.get(Attr.uid);
    let i = 0
    let wallpaper = wallpapers[index];
    while (!wallpaper && i < 30) {
      i++;
      index = Math.floor(Math.random() * wallpapers.length);
      wallpaper = wallpapers[index];
    }
    let { vhost, nid, hub_id } = wallpaper;
    let { settings } = await this.yp.await_proc("entity_touch", uid) || {};
    settings = JSON.parse(settings);
    settings.wallpaper = {
      vhost, nid, hub_id
    }
    await this.yp.call_proc("drumate_update_settings", uid, settings);
  }

  /** 
   * 
   */
  async setupAvatar() {
    let avatar = this.get('avatar');
    let avatar_file = resolve(AVATAR_DIR, avatar);
    this.debug("AAA:241", { avatar_file });
    if (!existsSync(avatar_file)) {
      console.warn("Avatar file not found", avatar_file);
      return
    }

    const filepath = join(this.get(Attr.home_dir), "__config__", "icons");
    mkdirSync(filepath, { recursive: true });

    if (!existsSync(filepath)) {
      console.warn(`Could not create ${filepath}`);
      return
    }
    this.debug("AAA:255", { avatar });
    let ext = extname(avatar);
    if (ext) {
      ext = ext.replace(/^\.+/, '');
    }

    const orig = `${filepath}/orig.${ext}`;
    copyFileSync(avatar_file, orig);
    this.debug("AAA:264", { avatar_file, orig });
    Generator.create_avatar(-2, ext, this.get(Attr.home_dir), orig);
    await this.yp.await_proc("entity_touch", this.get(Attr.uid));
    if (UID == 0) {
      exec(`chown -R ${system_user}:${system_group} ${filepath}`)
    }
  }

  /**
   * 
   * @param {*} opt 
   * @returns 
   */
  async createHub(data, options = {}) {
    let { domain, area } = data;
    if (!area) area = Attr.public;

    let filename = options.filename || uniqueNamesGenerator(hubNameConfig);
    let hubname = filename.replace(/ +/g, '-').toLowerCase();

    let sql = "SELECT count(*) `exists` FROM hub WHERE hubname=?"
    let { exists } = await this.yp.await_query(sql, hubname);
    let i = 0;
    while (parseInt(exists)) {
      i++;
      hubname = `${hubname}-${i}`;
      exists = await this.yp.await_query(sql, hubname).exists;
    }
    let owner_id = this.get(Attr.id);
    if (!owner_id) {
      this.debug("owner_id must be defined");
      return null;
    }

    let db_name = this.get(Attr.db_name);
    if (!db_name) {
      this.debug("No db name found");
      return null;
    }
    const args = { domain, hubname, area, owner_id, filename };
    const rows = await this.yp.await_proc(
      `${db_name}.desk_create_hub`, args, options
    );
    let hub_id;
    let home_id;
    for (let r of rows) {
      if (r && r.failed) {
        console.log({ db_name, hubname, area, owner_id }, rows);
        console.log("FACTORY_ERROR")
        return null;
      }
      if (r.hub_id) {
        hub_id = r.hub_id;
      }
      if (r.home_id) {
        home_id = r.home_id;
      }
    }

    const hub = await this.yp.await_proc("get_hub", hub_id);
    if (isEmpty(hub)) {
      consle.log("INVALID_HUB")
      return null;
    }

    let folders = [];
    for (let i = 0; i < 5; i++) {
      folders.push({ path: uniqueNamesGenerator(folderNameConfig) })
    }
    this.trigger('progress');
    await this.iniFolders(hub, folders);
    db_name = hub.db_name;
    owner_id = hub.owner_id;
    home_id = hub.home_id;
    let home_dir = hub.home_dir;
    const mfs = new Mfs({ db_name, owner_id, yp: this.yp });
    let url = `${contentBase}/${area}/Readme.md`;
    let dest = { home_dir, owner_id, nid: home_id };
    await mfs.importFile(url, dest);
    await mfs.end();
    return hub;
  }

}
module.exports = Drumate;