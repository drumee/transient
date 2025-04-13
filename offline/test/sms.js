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
const Backbone  = require('backbone');
const Jsonfile    = require('jsonfile');
const Path        = require('path');

const opt = Jsonfile.readFileSync(
  Path.resolve('/etc/drumee/credential', 'ovh', 'sms.json')
);
const connector = require('ovh')(opt)
console.log("ENV ------------ ", opt);

connector.request('GET', '/sms', (error, serviceName)=> {
  if(error) {
    reject({error});
  }
  else {
    console.log("My account SMS is " + serviceName);

    // Send a simple SMS with a short number using your serviceName
    let cmd = `/sms/${serviceName}/jobs/`;
    let args = {
      message: "Coucou",
      sender: "Drumee",
      receivers: [ '+33607152508' ]
    };
    console.log(`Sending ${cmd}`, args);
    connector.request('POST', cmd, args, (err, result)=> {
      if(err){
        console.error({error:err, message:result});
        return;
      } 
      console.log(result);
    });
  }
})
