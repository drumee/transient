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
const { Attr, utils } = require("@drumee/server-essentials");
const { isEmpty } = require('lodash');
const { toArray } = utils;


const { Mfs } = require('@drumee/server-core');

class __public_seo extends Mfs {

  async create() {
    const { node } = this.source_granted();
    if ([Attr.document, Attr.image].includes(node.filetype)) {
      const Document = require('@drumee/server-core/utils/document')();
      Document.buildIndex({ ...node, uid: this.uid });
      this.output.data(node);
    } else {
      this.output.data({});
    }
  }


  /**
   * 
   * @param {*} id 
   * @param {*} vcf 
   * @returns 
   */
  async find(id, vcf) {
    let nid = this.source_granted().id;
    const string = this.input.get(Attr.string) || '';
    const page = this.input.get(Attr.page) || 1;
    let words = string.split(/[ ,.;:!%@\/=\+-_\#]/).filter((e) => { return e.length });
    if (isEmpty(string)) {
      this.output.data([]);
      return;
    }
    let res = await this.db.await_proc('seo_search', JSON.stringify(words), page);
    let nodes = [];
    this.debug(' AAA', res);

    for (var r of toArray(res, 1)) {
      nodes.push(JSON.parse(r.node));
    }
    this.output.list(nodes);
  }
}


module.exports = __public_seo;
