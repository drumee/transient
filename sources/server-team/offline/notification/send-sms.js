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
const { exit } = require('process');
const argv = Minimist(process.argv.slice(2));
const { Mariadb, Offline} = require('@drumee/server-essentials');

/**
 * 
 */
class __offline_sms extends Offline {
  /**
   * 
é
  /**
   * 
   * spawn(cmd, [hub_id, message, flag, lang, username, link, icon, opt], {detached: true});
   */
  initialize() {
    if (!argv.message || !argv.phone) {
      console.error("required otpions : --message=\"your messages....\" --phone=\"+1234\"")
      exit(1);
    }
    this.yp = new Mariadb({ user: process.env.USER });

    // this.lang = this.lang || 'en';
    // this.cache = new Cache({ yp: this.yp, lang: this.lang });
    this.prepare().then().catch((e) => {
      console.log(`GT ERROR: ${e.toString()}`);
      exit(1);
    });
  }

  /**
   * 
   * @param {*} opt 
   */
  _failover_sms(opt) {
    let Sms = require('../../vendor/ovh/sms');
    let sms = new Sms(opt);
    sms.send()
      .then(() => {
        console.log("Message sent to", argv.phone);
        exit(0);
      })
      .catch((e) => {
        this.warn("FAILED TO SEND OTP. Giving up", e);
        console.log("MSG_NOT_SENT");
      })

  }


  /**
   * 
   */
  async prepare() {
    //await this.cache.load();
    let Sms = require('../../vendor/smsfactor');
    if(!/^\+.+$/.test(argv.phone)){
      argv.phone = `+${argv.phone}`;
    }
    let opt = {
      message: `${argv.message}`,
      receivers: [argv.phone]
    }
    let sms = new Sms(opt);
    const timer = setTimeout(() => {
      this._failover_sms(opt)
    },
      3500
    );
    sms.send()
      .then((result) => {
        if (timer) clearTimeout(timer);
        console.log("Message sent to", argv.phone);
        exit(0);
      }).catch((e) => {
        this.warn("FAILED TO SEND OTP. Trying alternat", e, opt);
        this._failover_sms(opt);
      })
  }


}

new __offline_sms();
