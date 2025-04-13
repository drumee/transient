#!/usr/bin/env node
/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.gnu.org/licenses/agpl-3.0.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Minimist = require('minimist');
const { exit } = require('process');
const Jsonfile = require('jsonfile');
const Path = require('path');
const Shell = require('shelljs');
const Fs = require("fs");
const {Mariadb, Offline} = require('@drumee/server-essentials');

class __media_recover extends Offline {



  // ========================
  // initialize
  // ========================
  initialize() {
    const argv = Minimist(process.argv.slice(2));
    this.db = new Mariadb({ user: process.env.USER, name: "d_a82214baa82214c6" });


    this.prepare()
      .then(() => { exit(0) })
      .catch((e) => {
        console.error('eee', e);
        exit(0);
      });
  }

  /**
   * 
   * @param {*} msg 
   */
  stop(msg) {
    exit(0);
  }

  /**
   * 
   * @param {*} msg 
   */

  /* 
  */
  async prepare() {

    const data = Jsonfile.readFileSync('/tmp/regis.json');
    for (var nid of data) {
      //console.log(`PATHS  =${r.file_path}`)
      console.log(`PROCESSING NID=${nid}`);
      let r = await this.db.await_proc('mfs_node_attr', nid);
      if (r.home_dir && r.filetype == 'document') {
        let src = Path.resolve(r.home_dir, nid, 'orig.' + r.ext);
        let p = Path.join('/srv/drumee/runtime/tmp/regis', r.parent_path.replace(/(__trash__)|([ ]+)|(__chat__)/, ''));
        if (!Fs.existsSync(p)) {
          Shell.mkdir('-p', p);
        }
        let f = Path.join(p, `${r.filename}.${r.extension}`);
        console.log("Copying", src, '-->', f);
        Shell.cp(src, f);
      }
    }

  }


}

new __media_recover();
