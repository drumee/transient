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
const { readFileSync: readJson, writeFileSync: writeJson } = require('jsonfile');
const { exec } = require('shelljs')
const { join, resolve } = require('path');
const { existsSync, writeFileSync, readFileSync } = require("fs");
const { spawn: Spawn } = require("child_process");
const SEPARATOR = /[ ,.:;?!\/\-\_\$\&\'\"\\|\@=+\t\n\r\f\)\(\[\]\’\`]+/;
const tesseract = require("node-tesseract-ocr");
const { remove_item } = require('@drumee/server-core').MfsTools;
const { Mariadb, Attr, Offline } = require('@drumee/server-essentials');

class __seo_indexer extends Offline {


  // ========================
  // initialize
  // ========================
  initialize() {
    const argv = Minimist(process.argv.slice(2));
    let node;
    try {
      node = JSON.parse(argv._[0]);
      //console.log(node);
    } catch (e) {
      console.error("Failed to parse arguments", e);
      exit(1);
    }
    let db_name = node.actual_db || node.db_name;
    this.db = new Mariadb({ name: db_name });
    this.node = node;
    // Logger.debug(`START`);
    this.syslog(`START INDEXING ${node.filename} ${node.filetype}`);
    if (![Attr.document, Attr.image].includes(node.filetype)) {
      this.syslog('Unsupported file type', node.filetype);
      process.exit(1);
    } else {
      this.parse(node).then().catch((e) => {
        this.stop(e);
      });
    }

  }


  /**
   * 
   * @param {*} a 
   */
  stop(a) {
    if (!a) {
      this.syslog('INDEXING DONE', this.node.filename);
    } else {
      this.syslog('STOP INDEXING DUE TO ERROR', a);
    }
    super.stop(a);
    process.exit();
  }
  /**
   * 
   */
  fromImage(src, index) {
    if (!existsSync(src)) {
      this.syslog(`Source file not found *${src}*`);
    }
    const config = { lang: "eng", oem: 1, psm: 11 } //see docs to config
    tesseract
      .recognize(src, config)
      .then((text) => {
        console.log("Result:", text);
        writeFileSync(index, text, 'utf8');
      }).catch((e) => {
        this.syslog(`Failed to convert *${src}* ${e.toString()}`);
      })
  }

  /**
   * 
   */
  fromPdf(src, index) {
    if (existsSync(src)) {
      let cmd = `/usr/bin/pdftotext ${src} ${index}`;
      this.syslog(`RUN CMD = ${cmd}`);
      this.exec(cmd);
    } else {
      this.stop(`Could not find source file ${src}`);
    }
  }

  /**
   * 
   */
  index_medata(){

  }
  
  /**
   * 
   * @param {*} file 
   */
  async parse(node) {
    const mfs_dir = resolve(node.mfs_root, node.id);
    let index = join(mfs_dir, `index.txt`);
    let src = resolve(mfs_dir, `orig.${node.extension}`);
    let attr = await this.db.await_proc('mfs_access_node', node.uid, node.id);
    switch (node.extension) {
      case 'pdf':
        if (node.file && existsSync(node.file)) {

          //pdfinfo
          /*
            var pdf = PDF(node.file);
            pdf.info(function(err, meta){
              if (err) throw err;
              console.log('pdf info', meta.pdf_version);
            })
              if (meta.pdf_version >= 1.4) {
                cmd = `/usr/bin/pdftotext ${node.file} ${index}`;
                this.exec(cmd);
              }
          */

          var input = mfs_dir + '/orig.pdf';
          pdf2img.setOptions({
            type: 'jpg',
            size: 1024,
            density: 600,
            outputdir: join(mfs_dir, sep, 'jpgout'),
            outputname: null,
            page: null
          });

          pdf2img.convert(input, function (err, info) {
            if (err) console.log(err)
            else console.log(info);
          });

          node.file = join(mfs_dir, 'jpgout', 'orig_1.jpg');
          const config = { lang: "eng", oem: 1, psm: 11 } //see docs to config
          tesseract
            .recognize(node.file, config)
            .then((text) => {
              console.log("Result:", text);
              writeFileSync(index, text, 'utf8');
            })
        }
        break;
      case 'html':
      case 'csv':
      case 'json':
      case 'log':
        this.fromPdf(src, index);
        break;
      case 'ppt':
      case 'pptx':
      case 'xls':
      case 'xlsx':
      case 'doc':
      case 'docx':
      case 'odt':
        src = resolve(mfs_dir, `preview.pdf`);
        if (existsSync(src)) {
          this.fromPdf(src, index);
        } else {
          src = resolve(mfs_dir, `orig.pdf`);
          if (existsSync(src)) {
            this.fromPdf(src, index);
          } else {
            let cmd = resolve(__dirname, 'to-pdf.js');
            let args = {
              node,
              uid: this.uid,
              noSocket: 1
            };
            exec(`${cmd} '${JSON.stringify(args)}'`);
            console.log(`Converting to pdf with\n ${cmd} '${JSON.stringify(args)}'`);
            Spawn(cmd, [JSON.stringify(args)]);
          }
        }
        break;
      //OCR
      case 'png':
      case 'jpg':
        this.fromImage(src, index);
        break;
      default:
        this.stop(`Unsupported file extension (${node.extension})`);
        return;
    }

    if (!existsSync(index)) {
      this.stop(`file not found ${index}`);
      return;
    }

    let doc = readFileSync(index, 'utf8');
    let newwords = doc.toLowerCase();
    let words = newwords.split(SEPARATOR).filter((e) => {
      if (!e) return false;
      if (e.length <= 2) return false;
      return (/\w/.test(e));
    });
    //let lexicon = sw.fr;
    //if (node.lang && sw[node.lang]) lexicon = sw[node.lang];
    //let words = sw.removeStopwords(oldwords, sw.fr);
    //console.log("GOT WORDS", attr);
    let data = [];
    words.map((w) => {
      data.push({ word: w, hub_id: node.hub_id, nid: node.id });
    });
    if (attr.file_path != null) {
      let p = attr.file_path.split(/\/+/);
      p.map((w) => {
        data.push({ word: w, hub_id: node.hub_id, nid: node.id });
      });
    }
    await this.db.await_proc("seo_index", JSON.stringify(data));
    await this.db.await_proc("seo_register", node.hub_id, node.id, JSON.stringify(attr));
    let info = join(mfs_dir, `info.json`);
    let json = readJson(info);
    json.index = new Date().getTime();
    writeJson(info, json);
    remove_item(index, 1);
    this.stop();
  }
}

new __seo_indexer();
module.exports = __seo_indexer;
