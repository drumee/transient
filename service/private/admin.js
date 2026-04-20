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
const { utils } = require("@drumee/server-essentials");
const { toArray } = utils;
const { isEmpty, isArray } = require("lodash");
const { Mfs } = require("@drumee/server-core");

class __admin extends Mfs {

  /**
   *
   * @returns
   */
  async member_stats() {
    let org = await this.yp.await_proc('organisation_get', this.user.domain_id());
    if (isEmpty(org)) return this.output.status('NO_ORG');
    let data = await this.yp.await_proc('member_list_stats', org.id);
    this.output.data(data);
  }

  /**
   *
   * @returns
   */
  async member_list_workspaces() {
    let user_id = this.input.need(Attr.user_id);
    let { my_org } = await this._check_sanity(user_id) || {};
    if (!my_org) return;
    let data = await this.yp.await_proc('member_list_workspaces', user_id, my_org.id);
    data = toArray(data);
    this.output.list(data);
  }

  /**
   *
   * @returns
   */
  async member_device_list() {
    let user_id = this.input.need(Attr.user_id);
    let { my_org } = await this._check_sanity(user_id) || {};
    if (!my_org) return;
    let data = await this.yp.await_proc('member_device_list', user_id);
    data = toArray(data);
    this.output.list(data);
  }

  /**
   *
   * @returns
   */
  async member_device_remove() {
    let user_id = this.input.need(Attr.user_id);
    let device_id = this.input.need('device_id');
    let { my_org } = await this._check_sanity(user_id) || {};
    if (!my_org) return;
    let data = await this.yp.await_proc('member_device_remove', device_id, user_id);
    this.output.data(data);
  }

  /**
   *
   * @returns
   */
  async member_device_remove_all() {
    let user_id = this.input.need(Attr.user_id);
    let { my_org } = await this._check_sanity(user_id) || {};
    if (!my_org) return;
    let data = await this.yp.await_proc('member_device_remove_all', user_id);
    this.output.data(data);
  }

  /**
   * Internal helper: collect UIDs that are workspace admins across all hubs belonging to the organisation
   */
  async _get_workspace_admin_uids(dom_id) {
    const hubs = toArray(
      await this.yp.await_proc('member_list_hubs_by_domain', dom_id)
    );
    const uidSet = new Set();
    for (let hub of hubs) {
      try {
        const db_name = hub.db_name ||
          await this.yp.await_func('get_db_name', hub.id);
        if (!db_name) continue;
        const admins = toArray(
          await this.yp.await_proc(`${db_name}.hub_get_workspace_admins`)
        );
        for (let a of admins) {
          if (a.entity_id) uidSet.add(a.entity_id);
        }
      } catch (e) {
        this.warn(`[_get_workspace_admin_uids] Failed for hub ${hub.id}:`, e && e.message);
      }
    }
    return [...uidSet];
  }

  /**
   *
   * @returns
   */
  async member_set_workspace_admin() {
    let user_id = this.input.need(Attr.user_id);
    let hub_ids = this.input.need(Attr.hub_id);
    if (!isArray(hub_ids)) hub_ids = [hub_ids];

    let { my_org } = await this._check_sanity(user_id) || {};
    if (!my_org) return;

    let result = [];
    for (let hub_id of hub_ids) {
      try {
        let hub = await this.yp.await_proc('entity_touch', hub_id);
        if (isEmpty(hub) || hub.dom_id != my_org.domain_id) continue;
        const db_name = await this.yp.await_func('get_db_name', hub_id);
        if (!db_name) continue;
        let res = await this.yp.await_proc(
          `${db_name}.permission_grant`,
          '*', user_id, 0, 31, 'system', 'workspace_admin'
        );
        result.push({ hub_id, ...toArray(res)[0] });
      } catch (e) {
        this.warn(`[member_set_workspace_admin] Failed for hub ${hub_id}:`, e && e.message);
      }
    }
    this.output.list(result);
  }

  /**
   *
   * @returns
   */
  async member_remove_workspace_admin() {
    let user_id = this.input.need(Attr.user_id);
    let hub_ids = this.input.need(Attr.hub_id);
    if (!isArray(hub_ids)) hub_ids = [hub_ids];

    let { my_org } = await this._check_sanity(user_id) || {};
    if (!my_org) return;

    for (let hub_id of hub_ids) {
      try {
        let hub = await this.yp.await_proc('entity_touch', hub_id);
        if (isEmpty(hub) || hub.dom_id != my_org.domain_id) continue;
        const db_name = await this.yp.await_func('get_db_name', hub_id);
        if (!db_name) continue;
        await this.yp.await_proc(
          `${db_name}.permission_grant`,
          '*', user_id, 0, 7, 'system', 'member'
        );
      } catch (e) {
        this.warn(`[member_remove_workspace_admin] Failed for hub ${hub_id}:`, e && e.message);
      }
    }
    this.output.data({ status: 'done' });
  }

  /**
   *
   * @returns
   */
  async member_list_workspace_admins() {
    let org = await this.yp.await_proc('organisation_get', this.user.domain_id());
    if (isEmpty(org)) return this.output.status('NO_ORG');

    const workspace_admin_uids = await this._get_workspace_admin_uids(org.domain_id);
    if (!workspace_admin_uids.length) return this.output.list([]);

    let result = [];
    for (let uid of workspace_admin_uids) {
      try {
        let member = await this.yp.await_proc('show_member_detail', uid, org.id);
        if (isEmpty(member)) continue;
        result.push(member);
      } catch (e) {
        this.warn(`[member_list_workspace_admins] Failed for uid ${uid}:`, e && e.message);
      }
    }
    this.output.list(result);
  }

  /**
   * Internal sanity check — verify caller and target belong to same org
   */
  async _check_sanity(user_id) {
    let user = await this.yp.await_proc("get_user", user_id);
    let my_org = await this.user.organization();
    if (isEmpty(user) || !user.db_name) {
      return this.output.status('NO_ORG');
    }
    if (isEmpty(my_org) || !my_org.domain_id) {
      return this.output.status('NO_ORG');
    }
    if (my_org.domain_id != user.domain_id) {
      return this.output.status('INVALID_ORG');
    }
    return { user, my_org };
  }
}

module.exports = __admin;