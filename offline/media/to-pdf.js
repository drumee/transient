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
const { writeFileSync, readFileSync } = require('jsonfile');
const { resolve, join } = require('path');
const { remove_dir } = require('@drumee/server-core').MfsTools;
const { getPdfInfo } = require('@drumee/server-core').Document;
const { rmSync, renameSync, mkdirSync, existsSync } = require("fs");

const {
  RedisStore, Mariadb, Offline, Script, Attr
} = require('@drumee/server-essentials');

class __pdf_builder extends Offline {
  // ========================
  // initialize
  // ========================
  initialize() {
    this.syslog(`Starting PDF builder`);
    this.info = this.checkSanity();
    if (this.info.locked) {
      this.syslog(`${this.info.origFile} is locked since ${this.info.locked}`);
      if ((new Date().getTime() - this.info.locked) < 120) {
        this.syslog(`Exiting: too early`);
        process.exit(1);
      }
    }

    let res = new RedisStore();
    res.init().then(() => {
      this.prepare()
        .then(async () => {
          await this.build();
        })
        .catch(async (e) => {
          this.syslog("Failed to build [44]:", e);
          if (this.failedReason == 'no_dest') {
            this.syslog("Trying to build without socket");
            try {
              await this.build();
            } catch (e) {
              this.syslog("Failed to build - gave up", e);
              rmSync(this.lockFile);
              process.exit(1);
            }
          };
        });
    });
  }

  syslog(...args) {
    console.log(...args);
    super.syslog(...args);
  }
  /**
   * 
   */
  async build() {
    if (this.info.origFile) {
      this.syslog(`Building from MFS location`);
      this.buildFromOrig();
    } else {
      this.syslog(`Building from cache location`);
      this.buildFromCache();
    }

    this.syslog(`FINISHED SUCCESSFULY`);
    await this.onCompletion();
    this.syslog(`Build completed successfully. ${this._preview}`);
    setTimeout(() => {
      rmSync(this.lockFile);
      process.exit(0);
    }, 3000);
  }

  /**
 * 
 */
  async onCompletion() {
    this._payload.options.message = "PREVIEW_DONE";
    this._payload.options.progress = 100;
    await RedisStore.sendData(this._payload, this.recipients);
  }


  /**
   * 
   */
  checkSanity() {
    const Minimist = require('minimist');
    const argv = Minimist(process.argv.slice(2));
    let { node, socket_id, uid, noSocket } = JSON.parse(argv._[0]);
    this.noSocket = noSocket;
    if (!node.mfs_root) node.mfs_root = resolve(node.home_dir, '__storage__');
    const mfs_dir = resolve(node.mfs_root, node.id);
    this.socket_id = socket_id;
    this.uid = uid;
    this.lockFile = resolve(mfs_dir, `lock.json`);
    this.node = node;
    this.mfs_dir = node.mfs_root;

    this.yp = new Mariadb({ user: process.env.USER });
    let origFile = resolve(mfs_dir, `orig.${node.ext}`);
    this.origFile = origFile;
    if (existsSync(this.lockFile)) {
      return readFileSync(this.lockFile);
    }

    this.infoFile = resolve(mfs_dir, `info.json`);
    if (!existsSync(this.infoFile)) {
      throw `Info file (${this.infoFile}) not found`
    }
    let json = readFileSync(this.infoFile);
    if (!json.tmpfile || !existsSync(json.tmpfile)) {
      if (existsSync(origFile)) {
        json.origFile = origFile;
      } else {
        throw `Tmp file (${json.tmpfile}) not found`;
      }
    }
    json.buildState = 'started';
    writeFileSync(this.infoFile, json);
    return json;
  }

  /**
   * 
   */
  async prepare() {
    if (this.origFile) {
      writeFileSync(this.lockFile, {
        locked: new Date().getTime(),
        origFile: this.origFile
      });
    }
    if (!this.uid || this.noSocket) return;
    this.sender = await this.yp.await_proc("get_user", this.uid);
    this.recipients = await this.yp.await_proc("entity_sockets", this.uid);
    this.service = "media.status";
    let model = this.node;
    let options = {
      service: this.service,
      keys: [Attr.nid, Attr.hub_id],
      message: 'PREVIEW_GENERATION',
      progress: 0
    };
    this._payload = this.payload(model, options)

    await RedisStore.sendData(this._payload, this.recipients);

  }


  /**
   * 
   */
  buildFromCache() {
    let node = this.node;
    let mfs_root = node.mfs_root || this.mfs_dir;
    const mfs_dir = resolve(mfs_root, node.id);

    let outdir = resolve(this.info.fastdir, 'pdfout');
    let tmp_pdf = resolve(outdir, 'orig.pdf');
    mkdirSync(outdir, { recursive: true });

    // Build PDF from this.info.tmpfile into tmp_pdf
    let cmd = `${Script.soffice} ${outdir} ${this.info.tmpfile}`;
    this.exec(cmd);
    if (!existsSync(tmp_pdf)) {
      throw `Failed to build preview with CMD=${cmd}`;
    }
    let json = getPdfInfo(tmp_pdf);
    this.syslog(`CONVERT 471 cmd=${cmd}`, tmp_pdf);
    let preview = join(mfs_dir, `preview.pdf`);
    json.pdf = preview;
    json.buildState = 'done';
    writeFileSync(this.infoFile, json);
    this.syslog(`Renaming =${tmp_pdf} to ${preview}`);
    renameSync(tmp_pdf, preview);
    if (!existsSync(preview)) {
      throw `NOENT : buildFromCache file=${preview}`;
    }
    this._preview = preview;
    remove_dir(this.info.fastdir);
  }

  /**
   * 
   */
  buildFromOrig() {
    let node = this.node;
    let mfs_root = node.mfs_root || this.mfs_dir;
    const mfs_dir = resolve(mfs_root, node.id);
    const pdf = join(mfs_dir, 'orig.pdf');

    let preview = join(mfs_dir);
    let cmd = `${Script.soffice} ${preview} ${this.info.origFile}`;
    this.exec(cmd);
    if (!existsSync(pdf)) {
      throw `Failed to build preview with CMD=${cmd}`;
    }
    let json = getPdfInfo(pdf);
    json.pdf = pdf;
    json.buildState = 'done';
    this.infoFile = resolve(mfs_dir, `info.json`);
    writeFileSync(this.infoFile, json);
    if (!existsSync(json.pdf)) {
      throw `NOENT : buildFromOrig file=${json.pdf}`;
    }
    this._preview = json.pdf;
  }
}

try {
  new __pdf_builder();
} catch (e) {
  let msg = "Failed to run pdf builder" + e.toString();
  const Syslog = require("syslog-client-tls");
  const SyslogClient = Syslog.createClient("127.0.0.1");
}
module.exports = __pdf_builder;
