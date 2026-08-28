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
//const argv      = Minimist(process.argv.slice(2));
const {Mariadb, Logger} = require('@drumee/server-essentials');

class __analytics_users extends Logger {



  // ========================
  // initialize
  // ========================
  initialize() {
    this.yp = new Mariadb({user: process.env.USER });
    this.go();
    const argv = Minimist(process.argv.slice(2));
  }

  async go(){

    let users_count = function(s, e){
      let condition = `email not like "%drumee%" and status='active' and email not like "%xialia%" and ctime > ${s} and ctime < ${e}`;
      return `select count(*) as c from drumate inner join entity using(id) where ${condition}`;
    }

    let ts = await this.yp.await_query('select unix_timestamp() as now');
    let end = ts.now; //week = 60*60*24*7 / 2628000 = month
    let res;
    let time;
    let ptime;
    var nUsers = [];
    var date = [];
      for (let start = 1552296684; start < end; start = start + 2628000) {
        time = new Date(start * 1000);
        ptime = time.getDate()+ "/" +(time.getMonth()+1)+ "/" +time.getFullYear();
        res = await this.yp.await_query(users_count(start, end));
        this.debug(ptime ,'-->', res);

        nUsers.push(res.c);
        date.push(ptime);

      }
      nUsers.reverse();
      var total = [date, nUsers];
      this.debug(total);
  }
  
}

        //abs = date (start)
        //ord = users (res)

new __analytics_users();
module.exports = __analytics_users;
