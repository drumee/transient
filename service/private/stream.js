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
const { Attr } = require("@drumee/server-essentials");
const Media     = require('../media');

//########################################
class __private_stream extends Media {

  constructor(...args) {
    super(...args);
    this.create = this.create.bind(this);
  }

  /**
   * 
   * @returns 
   */
  async create() {
    const pid  = this.input.need(Attr.nid);
    const filename = this.input.need(Attr.name);
    if(_.isEmpty(filename)){
      this.exception.user('REQUIRE_NAME');
      return;
    }
    let args ={
      owner_id: this.uid,
      filename,
      pid,
      category: Attr.stream,
      ext: Attr.stream,
      mimetype: Attr.stream,
      filesize: 0,
      showResults :1
    };
    let results = { isOutput: 1 };
    await this.db.await_proc("mfs_create_node", args, {}, results);

  }

  /**
   * 
   */
  async open() {
    const pid     = this.source_granted().id || this.home_id;
    let filename = this.input.need(Attr.filename);
    let args ={
      owner_id: this.uid,
      filename,
      pid,
      category: Attr.stream,
      ext: Attr.stream,
      mimetype: Attr.stream,
      filesize: 0,
      showResults :1
    };
    let results = { isOutput: 1 };
    await this.db.await_proc("mfs_create_node", args, {}, results);
  }

}


module.exports = __private_stream;
