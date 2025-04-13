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
const redis = require("redis");


const {Offline} = require('@drumee/server-essentials');
class __test_example extends Offline {



  // ========================
  // initialize
  // ========================
  initialize() {
    // let conf = Jsonfile.readFileSync(Path.resolve('configs/example.json'));

    const argv = Minimist(process.argv.slice(2));
    // this.db = new Db({ user: process.env.USER, name: conf.db_name });
    
    this.prepare();

    
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
    
    const client = redis.createClient({
      host: "141.95.64.148",
      port: 6379
    });
    // console.log(client);
    
  // client.on('connect', function () {
  //   client.subscribe('exchanges', (message) => {
  //       console.log(message); // 'message'
  //   });

  // }).on('error', function (error) {
  //   console.log(error);
  // });
  
  client.on('error', (err) => console.log('Redis Client Error', err));

  await client.connect();

  await client.ping();

  await client.set('key', 'value-1');
  const value = await client.get('key');
  console.log(value);

 
    // const client = createClient({
    //   // url: 'redis://alice:foobared@awesome.redis.server:6380'
    //   url: 'redis://141.95.64.148:6379'
    // }); 

    const subscriber = client.duplicate();

    await subscriber.connect();

    let a = await subscriber.subscribe('channel', (message) => {
      console.log(message); // 'message'
    });


    const publisher = client.duplicate();

    await publisher.connect();

    await publisher.publish('channel', 'messageing');
    // console.log(subscriber);

    // const data = Jsonfile.readFileSync('/some/files/test.json');

  }


}

new __test_example();
