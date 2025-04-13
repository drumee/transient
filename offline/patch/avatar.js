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
const _         = require('lodash');
const Fs        = require('fs');
const Shell     = require('shelljs');
const Readline  = require('readline-sync');

const {Offline, Mariadb} = require('@drumee/server-essentials');


class __patch_avatar extends Offline {
// ========================
// initialize
// 
// ========================
  initialize(opt) {
    this.yp    = new Mariadb({user:process.env.USER});
    // @_pass = @yp.config().password
    this._error = [];
  }
      
// ========================
  exec(home_dir, avatar) {
    //console.log(`${a.avatar} --> ${db_name}`);
    if(avatar && avatar !== 'default' ){
      // console.log("Copying",`${home_dir}/__storage__/${avatar}`, `${home_dir}/__config__`)
      const icons_dirs = `${home_dir}/__config__/icons`;
      const jpg = `${home_dir}/__storage__/${avatar}/orig.jpg`;
      const jpeg = `${home_dir}/__storage__/${avatar}/orig.jpeg`;
      const png = `${home_dir}/__storage__/${avatar}/orig.png`;
      Shell.mkdir('-p', icons_dirs);
      let fname;
      if(Fs.existsSync(jpg)){
        fname = jpg;
      }else if(Fs.existsSync(jpeg)){
        fname = jpeg;
      }else if(Fs.existsSync(png)){
        fname = png;
      }else{
        console.log("NOOP", `${home_dir}/__storage__/${avatar}`);
      }
      if(fname && Fs.existsSync(fname)){
        let output = `${icons_dirs}/avatar.png`;
        const cmd = `gm convert -auto-orient -thumbnail '600x600^' -gravity center ${fname} -extent 600x600 +profile \"*\" ${output}`;
        //console.log("CMD", cmd);
        Shell.exec(cmd);
      }
    }
  }

// ========================
  prepare(arg) {
    for (let a of arg) {
      try{
        let i = JSON.parse(a.profile);
        this.exec(a.home_dir, i.avatar);
      }catch{}
    }
    this.yp.end();
  }

// ========================
  start() {
    this._error = [];
    const self = this;
    this.yp.query(`select home_dir, profile from entity left join drumate using(id) where type='drumate'`, 
      function(e, d, f){
      if (e != null) {
        throw e; 
      }
      self.prepare(d);
    });
  }

}
module.exports = __patch_avatar;

// ========================
const start = function(){
  let e, target;
  const p = new __patch_avatar();
  try { 
    p.parse();
  } catch (error) { 
    e = error;
    console.log(e); //.join('\n')
    process.exit(1);
  }

  if (_.isArray(p._target)) {
    target = p._target.join(' ');
  } else { 
    target = p._target;
  }

  const msg = `This shallshall apply ${p.get('source')} on ${target}`;

  console.log(msg); 
  const res = Readline.question("Are you sure ? [Y/N]");

  if (!(['yes', 'Y', 'oui', 'O'].includes(res))) {
    console.log("\n..... Patch aborted !\n");
    process.exit(1);
  }
  
  try { 
    p.start();
  } catch (error1) { 
    e = error1;
    console.log("ERROR RAISED", e);
  }
};

start();
