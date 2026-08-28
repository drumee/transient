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
const { Attr, toArray } = require("@drumee/server-essentials");
const {isEmpty} = require("lodash");

const { Entity } = require("@drumee/server-core");
class __private_conference extends Entity {
  /**
   * To send notifications to online clients
   *
   * @params
   */
  async notify_peers(data) {
    let key = this.input.need(Attr.key);
    let clients = await this.db.await_proc("conference_show_peers", key);
    if (isEmpty(clients)) {
      return;
    }
    clients = toArray(clients);
    for (let dest of clients) {
      this.notify_socket(dest, data);
    }
    return clients;
  }

  /**
   * To enter the conference room
   *
   * @params
   */
  async enter() {
    const self = this;
    let key = self.input.need(Attr.key);
    let status = self.input.use(Attr.status, "waiting");
    let data = await self.db.await_proc("conference_enter", key, status);
    if (isEmpty(data)) {
      self.output.data([{ status: "try_again" }]);
      return;
    }
    data = toArray(data);
    await self.notify_peers(data);
    self.output.data(data);
  }

  /**
   * To show peers curently in the room
   */
  show_peers() {
    let key = this.input.need(Attr.key);
    this.db.call_proc("conference_show_peers", key, this.output.list);
  }

  /**
   * To leave the conference room
   * @params
   */
  async leave() {
    const self = this;
    let key = this.input.need(Attr.key);
    let data = await this.db.await_proc("conference_leave", key);
    if (isEmpty(data)) {
      self.output.list([]);
      return;
    }
    data = toArray(data);
    await self.notify_peers(data);
    if (data[0].status == Attr.stopped) {
      await this.db.await_proc("conference_stop");
    }
    self.output.data(data);
  }

  /**
   * To create a RTC session Offer
   * see : https://webrtc.org/getting-started/firebase-rtc-codelab
   * @params {object} as specified by https://www.w3.org/TR/webrtc/#rtcpeerconnection-interface
   */
  async add_candidate() {
    const candidate = this.input.need("candidate");
    const data = {
      callerId: this.uid,
      roomId: this.randomString(32),
      type: "candidate",
      candidate,
    };
    await this.notify_peers(data);
    this.output.data(data);
  }

  /**
   * To create a RTC session Offer
   * see : https://webrtc.org/getting-started/firebase-rtc-codelab
   * @params {object} as specified by https://www.w3.org/TR/webrtc/#rtcpeerconnection-interface
   */
  async create_answer() {
    const answer = this.input.need("answer");
    const data = {
      callerId: this.uid,
      roomId: this.randomString(32),
      type: "answer",
      answer,
    };
    await this.notify_peers(data);
    this.output.data(data);
    // this.notify_hub(this.hub.get(Attr.id), data);
    // this.output.data(data);
    //this.db.call_proc('channel_read_messages', id, this.output.data);
  }

  /**
   * To create a RTC session Offer
   * see : https://webrtc.org/getting-started/firebase-rtc-codelab
   * @params {object} as specified by https://www.w3.org/TR/webrtc/#rtcpeerconnection-interface
   */
  async create_offer() {
    const offer = this.input.need("offer");
    const data = {
      callerId: this.uid,
      roomId: this.randomString(32),
      type: "offer",
      offer,
    };
    await this.notify_peers(data);
    this.debug("ZZZ", this.hub.get(Attr.id), offer);
    this.output.data(data);
    // this.notify_hub(this.hub.get(Attr.id), data);
    // this.output.data(data);
    // //this.db.call_proc('channel_read_messages', id, this.output.data);
  }
}

module.exports = __private_conference;
