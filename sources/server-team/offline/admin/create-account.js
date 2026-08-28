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
const {Mariadb} = require('@drumee/server-essentials');
const yp = new Mariadb({ user: process.env.USER, verbose: 0 });
const Minimist = require('minimist');
const Path = require('path');
const argv = Minimist(process.argv.slice(2));
const Uniqid = require('uniqid');

function create() {
  let profile = {
    ...argv,
    sharebox: Uniqid(),
    otp: '0',
  };
  for(let k in profile){
    console.log("KKK", k, profile[k]);
  }
}

function usage(a) {
  const prog_name = Path.basename(process.argv[1]);
  if (a) {
    console.log(`Usage ${prog_name} :  ${a}`);
  } else {
    console.log(`Usage ${prog_name} --email=... username lastname `);
  }
  process.exit(1);
}

function done() {
  console.log('Done sucessfully', argv.test);
  yp.end();
  process.exit(0);
}

function failed(e) {
  console.error('Error occured : ', e);
  yp.end();
  process.exit(1);
}

function check_sanity(cb) {
  (argv.email && argv.username && argv.lastname && argv.firstname) || usage();
  (process.env.USER == 'root') || usage('Must be run by root');
}

check_sanity();
removeAccount({ ...argv, yp }).then(done).catch(failed);

