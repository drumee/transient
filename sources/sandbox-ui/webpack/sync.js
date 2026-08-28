const { resolve, join } = require("path");
const { exec } = require('shelljs');
const { writeFileSync, readFileSync } = require('jsonfile');
const {
  existsSync,
  writeFileSync: fsWriteFile,
  readFileSync: fsReadFile
} = require('fs');
const { template } = require('lodash');

class DrumeeSyncer {
  constructor(opt) {
    this.options = opt || {};
    this.src_path = resolve(__dirname, '..');
  }

  apply(compiler) {
    compiler.hooks.done.tap('Drumee Sync Plugin', (
      stats /* stats is passed as argument when done hook is tapped.  */
    ) => {
      const { entry_page, src_path, bundle_base } = this.options;
      console.log("Building with options:", this.options);
      if(entry_page){
        let tpl = join(src_path, entry_page);
        console.log("Building entry page:", src_path, tpl);
        if (existsSync(tpl)) {
          let html = fsReadFile(tpl);
          html = String(html).trim().toString();
          let { hash } = stats;
          let dest = join(bundle_base, entry_page);
          console.log("Writing entry page to", dest);
          let data = template(html)({ hash });
          fsWriteFile(dest, data)
        }else{
          console.warn("Entry page template was not found", tpl);
        }
      }
      this.get_hash(stats);

    });
  }



  /**
   * 
   * @param {*} stats 
   * @returns 
   */
  get_hash(stats) {
    console.log(`BUILDING FROM HASH=${stats.hash}`, stats.compiler);
    let {
      statics,
      src_path,
      bundle_path,
      bundle_base,
      no_hash,
      entry_page
    } = this.options;
    let file = resolve(bundle_path, "index.json");
    const { stdout } = exec("git log -1 --pretty=format:'%h'", { silent: true });
    let [commit] = stdout.split(':');
    let p = readFileSync(resolve(this.src_path, 'package.json'));
    let data = {
      hash: stats.hash,
      timestamp: new Date().getTime(),
      head: commit,
      rev: commit,
      version: p.version,
      no_hash: no_hash || 0,
      entry_page
    }
    console.log(`Writing data into ${file} `, data);
    try {
      writeFileSync(file, data);
      if (statics) {
        for (let entity of statics) {
          const src = resolve(src_path, entity);
          const dest = resolve(bundle_base, entity);
          console.log("SYNCING STATICS...", `${src} ${dest}`);
          exec(`rsync -razv ${src} ${dest}`);
        }
      }
    } catch (e) {
      console.error(`GOT ERROR while trying to sync: \n`, e);
      return;
    }
    console.log(`Done.`);
    return data;
  }
}

module.exports = DrumeeSyncer;
