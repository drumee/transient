
let __singleton;
const SystemClasses = require('./seeds/static');
const AppClasses = {};
const Addons = require("./seeds/addons");
const { fetchService, loadJS } = require("@drumee/ui-essentials");
const Plugins = new Map();

/**
  @param string name
*/
function listSeeds(Obj, name) {
  const style = "color: green; font-weight: bold;"
  let keys = _.keys(Obj)
  if (name) {
    keys = keys.filter((k) => {
      return (new RegExp(name).test(k))
    })
  }
  for (let i of keys) {
    console.log(i + " -> " + "%c" + Obj[i], style)
  }
  return keys
};


/**
 * 
 */
class __kind extends Backbone.Model {

  initialize() {
    this.loader = require('./loader.js').default;
    this.trigger(_e.ready);
    this._isReady = 1;
    this.fetchService = fetchService.bind(this)
  }

  /**
   * 
   * @param {*} t 
   */
  exists(t) {
    return SystemClasses[t] || AppClasses[t] || Addons.get(t);
  }

  /**
    @param string name
  */
  list(name) {
    listSeeds(Addons.Registry, name)
    listSeeds(AppClasses, name)
    listSeeds(SystemClasses, name)
  };

  /**
   * 
   * @returns 
   */
  isReady() {
    if (this.loader) return true;
    return false;
  }

  /**
   * 
   * @param {*} n 
   * @param {*} d 
   * @returns 
   */
  ensure(n, d) {
    if (this.exists(n)) {
      return this.get(n);
    }
    return this.register(n, d);
  }

  /**
   * 
   * @param {*} args (string or object) 
   * @param {*} ref (import promise)
   * @returns 
   */
  registerAddons(args, ref) {
    if (_.isString(args)) {
      Addons.register(args, ref);
    } else if (_.isObject(args)) {
      for (let kind in args) {
        Addons.register(kind, args[kind])
      }
    } else if (_.isArray(arg)) {
      for (let item of args) {
        if (_.isObject(item)) {
          for (let kind in item) {
            Addons.register(kind, item[kind])
          }
        } else if (_.isArray(item)) {
          Addons.register(item[0], item[1])
        }
      }
    }
    this.trigger("addons:registered")
  }

  /**
   * 
   * @param {*} k 
   * @param {*} v 
   * @param {*} verbose 
   * @returns 
   */
  register(k, v, verbose = 0) {
    if(!v){
      this.warn(`Kind ${k} pointing to null widget`);
      return
    }
    if (AppClasses[k]) {
      if (verbose) {
        this.warn(`Kind ${k} already exists. Use method replace`);
      }
      return;
    }
    //@warn "FORCE OVERWRITING KIND #{k}"
    if (SystemClasses[k]) {
      this.warn(`Kind *${k}* is reserved, it cannot be reused.`);
      return;
    }
    if (v.default) {
      AppClasses[k] = v.default
    } else {
      AppClasses[k] = v;
    }
    return AppClasses[k]
  }


  /**
   * 
   * @param {*} k 
   * @param {*} v 
   * @returns 
   */
  replace(k, v) {
    if (SystemClasses[k]) {
      this.warn(`Kind ${k} is reserved. It cannot be resused`);
      return;
    }
    return AppClasses[k] = v;
  }


  /**
   * 
   * @param {*} name 
   * @returns 
   */
  get(name) {
    let f = SystemClasses[name] || AppClasses[name];
    if (_.isFunction(f)) {
      return f;
    }
    f = Addons.get(name)
    if (!f) {
      this.warn(`Failed to find kind for ${name}`);
      return null;
    }
    if (_.isFunction(f)) {
      let p = f()
      return this.loader(p);
    }
    if (_.isFunction(f.then)) {
      return this.loader(f);
    }
    this.warn(`Failed to find kind for ${name}`);
    return null;
  }

  /**
   * 
   */
  export_SystemClasses(pfx = 'letc') {
    let n;
    for (let k in SystemClasses) {
      n = _.camelCase(`${pfx}-${k}`);
      if (!window[n]) {
        this.debug(`Exporting ${n}`);
        window[n] = SystemClasses[k];
      } else {
        this.warn(`Failed to export kind ${n}. Name is already in use`);
      }
    }
  }


  /**
   * 
   * @param {*} name 
   */
  loadPlugin({ name, kind }) {
    return new Promise((resolve, reject) => {
      if (this.exists(kind)) {
        this.debug(`${kind} already exists. Using existing`);
        return resolve(this.get(kind))
        // return reject();
      }
      if (!SERVICE.bootstrap.plugin) {
        this.warn("Plugin service not found");
        return reject();
      }
      this.fetchService(SERVICE.bootstrap.plugin, {
        name,
      }).then((data) => {
        this.debug("Got plugin data", data)
        if (!data || !data.path) {
          this.warn("Plugin service not found");
          return reject();
        }
        if (Plugins.get(data.path)) {
          this.debug(`${kind} already loaded, skipped`, data.path);
          return resolve(this.get(kind))
        }
        this.once("addons:registered", () => { resolve(this.get(kind)) })
        loadJS(data.path).then(() => {
          Plugins.set(data.path, data)
          this.debug(`Plugin ${name} successfuly load as ${kind}`, data.path)
        }).catch((e) => {
          this.warn(`Failed to load js from ${data.path}`)
          reject(e)
        })
      }).catch((e) => {
        this.warn(`Failed to load plugin ${name} as kind ${kind}`)
        this.warn(e)
        reject(e)
      })
    })
  }

  /**
   * 
   * @param {*} name 
   * @returns 
   */
  async waitFor(name) {
    let f = SystemClasses[name] || AppClasses[name];
    if (_.isFunction(f)) {
      return f;
    }

    f = Addons.get(name);
    if (!f) {
      this.warn(`Could not wait for kind ${name}`);
      return null;
    }
    if (_.isFunction(f)) {
      let p = f()
      let r = await p.then((e) => {
        if (SystemClasses[name]) return SystemClasses[name];
        SystemClasses[name] = e.default;
        return e.default;
      });
      return r;
    }
    if (_.isFunction(f.then)) {
      let r = await f.then((e) => {
        if (SystemClasses[name]) return SystemClasses[name];
        SystemClasses[name] = e;
        return e;
      });
      return r;
    }
  }

  /**
   * 
   * @param {*} letc 
   * @param {*} map 
   * @param {*} clone 
   * @returns 
   */
  convert(letc, map, clone) {
    let data, f;
    if (clone == null) { clone = false; }
    if (!letc) {
      return null;
    }
    if (!(map != null ? map.match(/designer|reader/) : undefined)) {
      _c.error("Type.convert requires map name");
      return null;
    }
    if (clone) {
      data = _.clone(letc);
    } else {
      data = letc;
    }
    if ((map != null ? map.match(/designer/) : undefined)) {
      f = this.toDesigner;
    } else {
      f = this.toReader;
    }
    var walk = function (item) {
      let i;
      item.kind = f(item.kind, map);
      if (item.kids != null) {
        for (i of Array.from(item.kids)) {
          walk(i);
        }
      }
      if (item.items != null) {
        for (i of Array.from(item.items)) {
          walk(i);
        }
      }
      if (item.trigger != null) {
        for (i of Array.from(item.trigger)) {
          walk(i);
        }
      }
      if (item.triggers != null) {
        return (() => {
          const result = [];
          for (i of Array.from(item.triggers)) {
            result.push(walk(i));
          }
          return result;
        })();
      }
    };
    if (_.isArray(data)) {
      for (let d of Array.from(data)) {
        if (d != null) {
          walk(d);
        }
      }
    } else {
      if (data != null) {
        walk(data);
      }
    }
    data.kind = f(data.kind, map);
    return data;
  }

}

if ((__singleton == null)) {
  __singleton = new __kind();
}

module.exports = __singleton;
