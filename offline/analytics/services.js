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
const _ = require('lodash');
const Path = require('path');
const Fs = require("fs");
const Shell = require('shelljs');
const {Mariadb, Logger} = require('@drumee/server-essentials');

class __analytics_services extends Logger {



  // ========================
  // initialize
  // ========================
  initialize() {
    this.yp = new Mariadb({user: process.env.USER });
    this.go();
    const argv = Minimist(process.argv.slice(2));
    let basedir = argv.basedir || Path.resolve(process.env.DRUMEE_SERVER_HOME, '.pm2', 'logs');
    let pattern = argv.pattern || "main-service-out-";
    this.debug(`Scan with basedir=${basedir}, pattern=${pattern}`);
    this.go(basedir, pattern);
  }

  async go(base, pattern){
    let line;
    let svc_tag = "Object:  ========== START SERVICE =========";
    let services = {};
    let files = Shell.exec(`find ${base} -name "${pattern}*"`, { silent: true }).stdout.split('\n');
    for(var file of files){
      if(!_.isEmpty(file) && Fs.existsSync(file)){
        let dod = Path.dirname(file);
        this.debug("SERVICES", dod.replace(/^[\.\/]+/, ""));
        let svc = Shell.exec(`grep "${svc_tag}" ${file}`, { silent: true }).stdout.split('\n');
        for(var s of svc){
          s = s.match(/(^.+\*)([a-z]+\.[a-z]+)(\*$)/);
          if(s && s[2]){
            let service = s[2];
            if(!services[service]){
              services[service] = 1;
            }else{
              services[service]++;
            }
          }
        }
      }
    }
    this.debug("SERVICES", services);
  }
}

new __analytics_services();

module.exports = __analytics_services;
