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
const Minimist = require("minimist");
const { exit } = require("process");
const { join } = require("path");
const { rmSync, existsSync } = require("fs");
const { readFileSync } = require("jsonfile");

const {
  RedisStore, Mariadb, Offline, toArray, sysEnv, sleep
} = require('@drumee/server-essentials');

class offline_media_purge extends Offline {
  /**
   * 
   */
  initialize() {
    const argv = Minimist(process.argv.slice(2));
    this.info = argv._[0];
    if (!existsSync(this.info)) {
      console.log("File not found", this.info);
      exit(1);
    }
    let data = readFileSync(this.info);
    this.yp = new Mariadb({ user: process.env.USER });
    const { entities, uid } = data;
    this.entities = entities || [];
    this.uid = uid;

    let res = new RedisStore();
    res.init().then(() => {
      this.prepare()
        .then(async () => {
          await this.run();
          this.debug("Done! WIll stop later");
          //this.stop();
          //exit(0);
        })
        .catch((e) => {
          this.warn("Error raised:", e);
          exit(1);
        });
    });
  }

  /**
   * 
   */
  async prepare() {
    this.sender = await this.yp.await_proc("get_user", this.uid);
    this.recipients = await this.yp.await_proc("entity_sockets", this.uid);
    this.recipients = toArray(this.recipients)
    this.service = "media.purge";
    let model = {
      phase: "prepare",
      progress: 0,
      total: this.entities.length
    };
    let options = {
      service: this.service,
      tag: this.service,
    };
    await RedisStore.sendData(this.payload(model, options), this.recipients);
  }

  /**
   *
   * @param {*} opt
   * @returns
   */
  async send(model, message) {
    if (!this.socket_id) {
      console.error("Error: No destination to send to");
      return;
    }
    this._payload.model = { ...this._payload.model, ...model };
    if (message) {
      this._payload.options.message = message;
    } else if (model.message) {
      this._payload.options.message = model.message;
    }
    await RedisStore.sendData(this._payload, this.recipients);
  }

  /**
   * 
   */
  async run() {
    let progress = 0;
    let entities = toArray(this.entities);
    let i = 1;
    let total = entities.length;
    let { data_dir } = sysEnv();
    let mfs_base = new RegExp('^' + join(data_dir, 'mfs' + '/.+/.+$'))
    let model = {
      phase: "progress",
      progress: 0,
      total
    };
    let options = {
      service: this.service,
      tag: this.service,
      progress
    };
    let payload = this.payload(model, options);
    let prev = 0;
    for (let e of entities) {
      progress = Math.ceil(i * 100 / total);
      payload.model.count = i;
      i++;
      let path = join(e.home_dir, e.id)
      if (mfs_base.test(path)) {
        rmSync(path, { recursive: true, force: true });
        if (i % 10 === 0) {
          await sleep(500)
        }
      } else {
        console.log("Invalid node path", mfs_base, path)
      }
      payload.model.progress = progress;
      payload.model.home_dir = e.home_dir;
      payload.model.nid = e.id;
      if (this.recipients && this.recipients.length && progress > prev) {
        await RedisStore.sendData(payload, this.recipients);
        prev = progress;
      }
    }
    payload.model.phase = "completed";
    await RedisStore.sendData(payload, this.recipients);
    rmSync(this.info, { force: true });
    exit(0);
  }
}

new offline_media_purge();
