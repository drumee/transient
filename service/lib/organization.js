const { toArray, uniqueId, Remit, Attr, RedisStore } = require("@drumee/server-essentials");
const { uniqueNamesGenerator, adjectives } = require('unique-names-generator');
const { isEmpty } = require("lodash");
const { DOM_OWNER, DOM_MEMBER } = Remit;
const domainConfig = {
  dictionaries: [adjectives],
  length: 1
}
const Drumate = require("./drumate");
const Demo = require(".");
global.verbosity = 4;
global.LOG_LEVEL = global.verbosity;


class Organization extends Demo {

  /**
  * 
  * @param {*} opt 
  */
  initialize(opt = {}) {
    this._progress = 0;
    this.socket_id = opt.socket_id;
    super.initialize(opt);
  }

  /**
 * 
 * @returns 
 */
  async updateProgress(type) {
    this.debug("PROGRESS:32", this._progress, this.socket_id);
    if (!this.socket_id) return;
    this._progress++;
    const model = {
      progress: this._progress,
      total: this._totalProgress
    };
    let payload = {
      service: "sandbox.progress",
      options: {
        service: "sandbox.progress",
        type: type || this._typeProgress
      },
      model
    };
    await RedisStore.sendData(payload, this.socket_id);
  }

  /**
   * 
   * @returns 
   */
  async createDomain() {
    let { ident, name } = await this.yp.await_proc(`sandbox.pickup_domain`);
    let fqdn = name;
    let dom = await this.yp.await_proc("domain_exists", fqdn);
    let vhost = await this.yp.await_proc("vhost_exists", fqdn);
    let i = 0;
    while (!isEmpty(dom) || !isEmpty(vhost)) {
      i++;
      let extra = uniqueNamesGenerator(domainConfig);
      let prefix = `${extra}-${ident}`;
      fqdn = `${extra}-${name}`;
      dom = await this.yp.await_proc("domain_exists", fqdn);
      vhost = await this.yp.await_proc("vhost_exists", fqdn);
      if (i > 1000000) {
        this.warn("Too much attemp to find valid domain name");
        break;
      }
      ident = prefix;
    }

    let domain = await this.yp.await_proc("domain_create", ident);
    this.domain = { ...domain, ident };
    this._totalProgress = 11;
    this.updateProgress();
    return this.domain;

  }

  /***
   * 
   */
  async remove(opt) {
    let { name, id } = opt;
    name = name || "";
    if (!name && !id) {
      this.debug("AAA:94 -- require name or id");
      return []
    }
    let dom = await this.yp.await_query(`SELECT * FROM domain WHERE name=? OR id=?`, name, id);
    let { count } = await this.yp.await_query(`SELECT count(*) count FROM entity WHERE dom_id=?`, id);
    this._totalProgress = Number(count) - 3;
    this._typeProgress = 'remove'
    let drumate = new Drumate({ yp: this.yp });
    drumate.on('progress', this.updateProgress.bind(this));
    let users = [];
    if (dom && dom.id) {
      this.debug("Removing", dom);
      users = await this.yp.await_query(`SELECT id, email FROM drumate WHERE domain_id=?`, dom.id);
      //this._totalProgress = users.length;
      for (let peer of toArray(users)) {
        drumate.remove(peer);
        this.updateProgress('remove');
        await this.yp.await_query(`DELETE FROM map_role WHERE uid=?`, peer.id);
        await this.yp.await_query(`DELETE FROM privilege WHERE uid=?`, peer.id);
        await this.yp.await_query(`DELETE FROM cookie WHERE uid=?`, peer.id);
        await this.yp.await_query(`DELETE FROM socket WHERE uid=?`, peer.id);
      }
      await this.yp.await_query(`DELETE FROM hub WHERE domain_id=?`, id);
      await this.yp.await_query(`DELETE FROM organisation WHERE domain_id=?`, id);
      await this.yp.await_query(`DELETE FROM domain WHERE id=?`, id);
      await this.yp.await_query(`DELETE FROM vhost WHERE dom_id=?`, id);
      await this.yp.await_query(`DELETE FROM map_role WHERE org_id=?`, id);
      await this.yp.await_query(`DELETE FROM sandbox.token WHERE domain=?`, name);
    } else {
      this.debug(`Organization name=${name}, id=${id} was not found`);
    }
    return users;
  }


  /**
   * 
   */
  async createOwner(wallpapers) {
    const { name, id, ident } = this.domain;
    let owner = new Drumate({ yp: this.yp, wallpapers });
    owner.on('progress', this.updateProgress.bind(this));

    try {
      await owner.create({
        domain: name,
        privilege: DOM_OWNER
      });
      if (!owner.get(Attr.uid)) {
        await this.remove(name, id);
        return null;
      }
    } catch (e) {
      console.error("Failed to create owner account", e);
      await this.remove(name, id);
      return null;
    }
    const orgParams = {
      owner_id: owner.get(Attr.uid),
      ident
    }
    let metadata = {
      category: "sandbox",
      ttl: "1 day",
    }
    let rows = await this.yp.await_proc(
      "organisation_create", orgParams, metadata
    );
    let organization = {};
    for (let r of rows) {
      if (r && r.failed) {
        console.error("Failed to create organization");
        console.log(rows);
        await this.remove(name, id);
        return null;
      }
      if (r.privilege) {
        organization = r;
        organization.user_domain = organization.link;
      }
    }
    try {
      await owner.createHub({ domain: name, area: Attr.public });
      await owner.createHub({ domain: name, area: Attr.private });
      await owner.createHub({ domain: name, area: Attr.dmz });
      await owner.createHub({ domain: name, area: Attr.dmz }, {
        filename: uniqueId(), is_wicket: 1
      });
    } catch (e) {
      console.error("Failed to create owner hubs", e);
      await this.remove(name, id);
      return null;
    }
    return owner;
  }

  /**
   * 
   */
  async AddMember(wallpapers) {
    let member = new Drumate({ yp: this.yp, wallpapers });
    member.on('progress', this.updateProgress.bind(this));
    const { name, id } = this.domain;

    try {
      await member.create({
        domain: name,
        privilege: DOM_MEMBER
      });
      if (!member.get(Attr.uid)) {
        await member.remove();
        return;
      }
    } catch (e) {
      console.error("Failed to create owner account", e);
      await member.remove();
      return;
    }
    try {
      await member.createHub({ domain: name, area: Attr.public });
      await member.createHub({ domain: name, area: Attr.private });
      await member.createHub({ domain: name, area: Attr.dmz });
      await member.createHub({ domain: name, area: Attr.dmz }, {
        filename: uniqueId(), is_wicket: 1
      });
    } catch (e) {
      console.error("Failed to create owner hubs", e);
      await member.remove();
      return null;
    }
    return member;
  }

  /**
   * 
   * @param {*} drumate 
   */
  async updateContacts(uid) {
    const { id } = this.domain;
    let peers = [];
    let list = await this.yp.await_proc('member_list_all', uid, id);
    for (let entity of toArray(list)) { peers.push(entity.drumate_id) }
    await this.yp.await_proc('contact_assignment_update', uid, peers);
  }

}
module.exports = Organization;