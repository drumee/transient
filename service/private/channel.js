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

const {
  Attr, RedisStore, toArray
} = require("@drumee/server-essentials");
const { Entity, MfsTools } = require('@drumee/server-core');
const { remove_node, move_node, copy_node, } = MfsTools;

const { stringify } = JSON;
const { isEmpty } = require('lodash');
const Crypto = require("crypto");

/** ========================================== */
class __private_channel extends Entity {
  constructor(...args) {
    super(...args);
    this.messages = this.messages.bind(this);
    this.post = this.post.bind(this);
    this.write = this.write.bind(this);
    this.list_notifications = this.list_notifications.bind(this);
    this.read = this.read.bind(this);
    this.notify_chat = this.notify_chat.bind(this);
    this.acknowledge = this.acknowledge.bind(this);
    this.bookmark_add = this.bookmark_add.bind(this);
    this.bookmark_remove = this.bookmark_remove.bind(this);
    this.bookmark_list = this.bookmark_list.bind(this);
    this.send_ticket = this.send_ticket.bind(this);
    this.post_ticket = this.post_ticket.bind(this);
    this.show_ticket = this.show_ticket.bind(this);
    this.list_tickets = this.list_tickets.bind(this);
    this.update_ticket = this.update_ticket.bind(this);
  }

  /**
   * 
   */
  notify_chat() {
    this.db.call_proc('channel_notify_messages', this.uid, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  async _get_wicket(uid) {
    let sbox = await this.db.call_proc("mfs_wicket_home", uid);
    if (sbox && sbox[5]) { /** Created by desk_create_hub */
      return sbox[5]
    }
    return sbox;
  }
  /**
   * 
   */
  async messages() {
    const order = this.input.use(Attr.order, 'asc');
    const page = this.input.use(Attr.page) || 1;
    let data = await this.db.await_proc('channel_list_messages', this.uid, 'date', order, page);
    data = toArray(data);
    let messages = [];

    let cache = {};
    let hub_id = this.hub.get(Attr.id);
    for (let message of data) {

      message.entity = { id: this.uid }
      if (message.author_id != this.uid) {
        let key = message.author_id;

        if (cache[key]) {
          message.entity = cache[key];
        }
        else {
          message.entity = await this.yp.await_proc('forward_proc', this.uid, 'shareroom_contact_get', `'${message.author_id}'`)
          cache[key] = message.entity;

        }
      }
      if (!isEmpty(message.thread_id)) {
        message.thread = await this.threadInfo(message.thread_id, hub_id)
      }
      messages.push(message)
    }
    let dest = await this.yp.await_proc('entity_sockets', hub_id);
    dest = toArray(dest).filter((e) => {
      return e.uid != this.uid;
    })
    await RedisStore.sendData(this.payload(messages, { service: "channel.acknowledge" }), dest);

    // Why do we need to inform the reader ?
    // dest = await this.yp.await_proc('user_sockets', this.uid);
    // let db_name = this.user.get(Attr.db_name);
    // let model = await this.yp.await_proc(`${db_name}.notification_center_next`);
    // await RedisStore.sendData(this.payload(model, { service: "messages.read" }), dest);

    this.output.list(messages);

  }

  /**
   * To get the  Attachments or media details for a array of ids 
   * @params {string[]} attachments - array of the media ids (nid)
   * @params {string} uid - hubid of the media
   * @todo Need to add to globle function 
   */
  async _getAttachmentsInfo(attachments, uid) {
    let files = [];
    attachments = toArray(attachments);
    for (let media of attachments) {
      let file = await this._getAttachmentInfo(uid, media);
      files.push(file)
    }
    return files;
  }

  /**
   * To get the  Attachment or media details for a  ids 
   * @params {string} uid - hubid of the media
   * @params {string} mediaId - id of a media (nid)
   * @todo Need to add to globle function 
   */
  async _getAttachmentInfo(uid, media) {
    let attr
    if (typeof media.hub_id !== 'undefined') {
      attr = await this.yp.await_proc('forward_proc', media.hub_id, 'mfs_access_node', `'${uid}', '${media.nid}'`)
    } else {
      attr = await this.db.await_proc('mfs_access_node', uid, media);
    }
    return this.output.sanitize(attr);
  }


  /**
   * 
   * @param {*} sbox 
   * @param {*} desdir 
   * @param {*} attachment 
   * @param {*} message_id 
   * @returns 
   */
  async move_attachemnt(sbox, desdir, attachment, message_id) {
    let src = []
    message_id = [message_id]
    for (let media of attachment) {
      src.push({ nid: media, hub_id: this.hub.get(Attr.id) })
    }

    let data = await this.db.call_proc('mfs_move_all', stringify(src), this.hub.get(Attr.id), desdir.id, sbox.hub_id);
    data = toArray(data);

    let tempattachment = []
    for (let node of data) {
      let dest = {}
      switch (node.action) {
        case 'move':
          src = { nid: node.nid, mfs_root: node.src_mfs_root };
          dest = { nid: node.des_id, hub_id: sbox.hub_id, mfs_root: node.des_mfs_root };
          tempattachment.push({ hub_id: sbox.hub_id, nid: node.des_id })
          await move_node(src, dest);
          break;
        case 'copy':
          src = { nid: node.nid, mfs_root: node.src_mfs_root };
          dest = { nid: node.des_id, hub_id: sbox.hub_id, mfs_root: node.des_mfs_root };
          tempattachment.push({ hub_id: sbox.hub_id, nid: node.des_id })
          await copy_node(src, dest, 1);
      }
    }

    for (let node of data) {
      switch (node.action) {
        case 'delete':
          src = { nid: node.nid, hub_id: sbox.hub_id, mfs_root: node.src_mfs_root };
          await remove_node(src, 1);
      }
    }
    if (this.hub.get(Attr.id) != this.uid) {
      for (let media of attachment) {
        tempattachment.push({ nid: media, hub_id: this.hub.get(Attr.id) })
      }
    }
    return tempattachment;
  }

  /**
   * 
   * @param {*} thread_id 
   * @param {*} uid 
   * @returns 
   */
  async threadInfo(thread_id, uid) {
    let thread = {}
    let data = await this.yp.await_proc('forward_proc', uid, 'channel_get', `'${thread_id}'`)

    if (isEmpty(data)) {
      thread.message = 'DELETED'
      thread.message_id = data.message_id
      return thread;
    }

    thread.message = data.message
    thread.message_id = data.message_id
    thread.is_attachment = 0
    if (!isEmpty(data.attachment)) {
      thread.is_attachment = 1
    }
    thread.author_id = data.author_id
    thread.entity = await this.yp.await_proc('forward_proc', this.uid, 'shareroom_contact_get', `'${data.author_id}'`)

    return thread;
  }

  /**
   * 
   */
  async list_tickets() {
    let status = this.input.use(Attr.status) || ['new'];
    const page = this.input.use(Attr.page) || 1;
    const search_ticket_id = this.input.use(Attr.ticket_id);

    let filter = {};
    let tickets = [];
    filter.status = status
    if (!isEmpty(search_ticket_id)) {
      filter.search_ticket_id = search_ticket_id
    }

    let sbox = await this._get_wicket(this.uid);
    let data = await this.yp.await_proc('forward_proc', sbox.hub_id, 'ticket_list', `'${this.uid}','${stringify(filter)}','${page}'`)

    data = toArray(data);

    for (let ticket of data) {
      ticket.metadata = this.parseJSON(ticket.metadata)
      tickets.push(ticket)
    }
    this.output.data(tickets)
  }

  /**
   * 
   * @returns 
   */
  async update_ticket() {
    const ticket_id = this.input.need(Attr.ticket_id);
    let status = this.input.use(Attr.status);
    let res = {};
    let metadata = {};
    let support_domain_id = Cache.getSysConf('support_domain');
    let my_org = await this.yp.await_proc('my_organisation', this.uid)

    if (my_org.domain_id != support_domain_id) {
      res.status = 'INVALID_DOMAIN'
      return this.output.data(res);
    }

    if (!isEmpty(status)) { metadata.status = status }
    let ticket = await this.yp.await_proc('ticket_detail', ticket_id);
    if (isEmpty(ticket)) {
      res.status = 'INVALID_TICKET'
      return this.output.data(res);
    }
    ticket = await this.yp.call_proc('ticket_update_metadata', ticket_id, metadata);
    ticket.metadata = this.parseJSON(ticket.metadata)

    let recipients = await this.yp.await_proc('user_sockets', ticket.uid);
    await RedisStore.sendData(this.payload(ticket), recipients);

    let support = await this.yp.call_proc('member_list_all', 'all', Cache.getSysConf('support_domain'));
    support = toArray(support);

    for (let member of support) {
      let recipients = await this.yp.await_proc('user_sockets', member.drumate_id);
      await RedisStore.sendData(this.payload(ticket), recipients);
    }
    this.output.data(ticket);
  }

  /**
   * 
   */
  async show_ticket() {
    const page = this.input.use(Attr.page) || 1;
    const ticket_id = this.input.need(Attr.ticket_id);

    let ticket = await this.yp.await_proc('ticket_detail', ticket_id);
    let sbox = await this.yp.await_proc('forward_proc', ticket.uid, 'mfs_wicket_home', `'${ticket.uid}'`);
    if (sbox[5]) { /** Created by desk_create_hub */
      sbox = { ...sbox[5] }
    }

    let data = await this.yp.await_proc('forward_proc', sbox.hub_id, 'ticket_show', `${ticket_id},'${this.uid}','${page}'`)
    data = toArray(data);

    let messages = [];
    for (let message of data) {
      if (message.is_seen == 1 && message.is_notify == 1) {
        let support = await this.yp.call_proc('member_list_all', this.uid, Cache.getSysConf('support_domain'));
        support = toArray(support);
        for (let member of support) {
          message.service = "channel.acknowledge";
          let recipients = await this.yp.await_proc('user_sockets', member.drumate_id);
          await RedisStore.sendData(this.payload(message), recipients);
        }

        let recipients = await this.yp.await_proc('user_sockets', this.uid);
        await RedisStore.sendData(this.payload(message), recipients);
      }
      message.entity = { id: this.uid }
      if (message.author_id != this.uid) {
        message.entity = await this.yp.await_proc('forward_proc', this.uid, 'shareroom_contact_get', `'${message.author_id}'`)
      }
      message.metadata = this.parseJSON(message.metadata)
      if (message.is_ticket == 1) {
        message.metadata.category_display = []
        for (let category of message.metadata.category) {
          switch (category) {
            case "tech":
              message.metadata.category_display.push("Tech Bug")
              break;
            case "design":
              message.metadata.category_display.push("Design Bug")
              break;
            case "notunderstand":
              message.metadata.category_display.push("Could't Understand")
              break;
            case "enhancement":
              message.metadata.category_display.push("Enhancement")
              break;
          }
        }
        message.metadata.where_display = []
        for (let where of message.metadata.where) {
          switch (where) {
            case "desktop":
              message.metadata.where_display.push("Desktop")
              break;
            case "chat":
              message.metadata.where_display.push("Chat")
              break;
            case "contactmanager":
              message.metadata.where_display.push("Contact Manager")
              break;
            case "teamroom":
              message.metadata.where_display.push("Team Room")
              break;
            case "sharebox":
              message.metadata.where_display.push("Share Box")
              break;
            case "profile":
              message.metadata.where_display.push("Profile")
              break;
            case "others":
              message.metadata.where_display.push("Others")
              break;
          }
        }
      }
      if (!isEmpty(message.thread_id)) {
        message.thread = await this.threadInfo(message.thread_id, sbox.hub_id)
      }
      messages.push(message)
    }
    this.output.list(messages);
  }

  /**
   * 
   * @param {*} hub_id 
   * @param {*} ticket_id 
   * @returns 
   */
  async autoreply(hub_id, ticket_id) {
    let reply = {}
    let input = {};
    let metadata = {};
    let message_id = await this.yp.await_func("uniqueId");
    await this.yp.await_proc('forward_proc', hub_id, 'map_ticket_add', `'${message_id}','${ticket_id}'`)
    input.author_id = 'autoreply'
    input.uid = 'autoreply'
    input.message_id = message_id
    input.metadata = metadata
    input.metadata.message_type = 'ticket_auto_reply'
    let message = Cache.message("_ticket_auto_reply", this.client_language());
    let data = await this.yp.await_proc('forward_proc', hub_id, 'channel_post_message_next', `'${stringify(input)}','${message}'`)
    return this.output.sanitize(data);
  }


  /**
   * 
   */
  async send_ticket() {
    let attachment = this.input.use(Attr.attachment, []);
    let message = this.input.need(Attr.message);
    let category = this.input.need(Attr.category, []);
    let alltime = this.input.use(Attr.alltime, 0);
    let where = this.input.use(Attr.where, []);
    const f = async () => {
      let metadata = {};
      let input = {};
      let message_id = await this.yp.await_func("uniqueId");
      let sbox = await this._get_wicket(this.uid);
      if (!isEmpty(attachment)) {
        let desdir = await this.yp.await_proc('forward_proc', sbox.hub_id, 'mfs_make_dir', `'${sbox.ticket_id}','${stringify(message_id)}',1`)
        attachment = await this.move_attachemnt(sbox, desdir, attachment, message_id)
      }
      metadata.status = 'new'
      if (!isEmpty(attachment)) { metadata.attachment = attachment }
      if (!isEmpty(category)) { metadata.category = category }
      if (!isEmpty(category)) { metadata.alltime = alltime }
      if (!isEmpty(where)) { metadata.where = where }
      if (!isEmpty(message)) { message = message.replace(/'/gi, "''"); }
      metadata.message = message;

      let ticket = await this.yp.await_proc('ticket_add', message_id, this.uid, metadata);
      metadata.ticket_id = ticket.ticket_id;


      await this.yp.await_proc('forward_proc', sbox.hub_id, 'map_ticket_add', `'${message_id}','${ticket.ticket_id}'`)
      input.author_id = this.uid
      input.uid = this.uid
      input.message_id = message_id
      input.metadata = metadata
      input.metadata.message_type = 'ticket'
      input.ticket_id = ticket.ticket_id;
      if (!isEmpty(attachment)) { input.attachment = attachment }
      let data = await this.yp.await_proc('forward_proc', sbox.hub_id, 'channel_post_message_next', `'${stringify(input)}','${message}'`)
      data.is_attachment = 0
      if (!isEmpty(input.attachment)) {
        await this.yp.await_proc('forward_proc', sbox.hub_id, 'channel_post_attachment', `'${message_id}','${sbox.hub_id}','${stringify(input.attachment)}'`)
        data.is_attachment = 1
      }
      data.ticket_id = ticket.ticket_id;
      let profile = this.user.get('profile') || {};
      data.lastname = profile.lastname;
      data.firstname = profile.firstname;
      let my_org = await this.yp.await_proc('my_organisation', this.uid)
      data.org_name = my_org.name
      data.metadata = metadata;

      let auto = await this.autoreply(sbox.hub_id, ticket.ticket_id)
      auto.service = "channel.post"

      auto.echoId = this.input.get('echoId');
      data.echoId = this.input.get('echoId');
      let keys = { entity_id: Attr.hub_id };
      let recipients = await this.yp.await_proc('user_sockets', ticket.uid);
      await RedisStore.sendData(this.payload(data, { keys }), recipients);
      await RedisStore.sendData(this.payload(auto, { keys }), recipients);
      let support = await this.yp.call_proc('member_list_all', this.uid, Cache.getSysConf('support_domain'));
      support = toArray(support);

      for (let member of support) {
        let recipients = await this.yp.await_proc('user_sockets', member.drumate_id);
        await RedisStore.sendData(this.payload(data, { keys }), recipients);
        await RedisStore.sendData(this.payload(auto, { keys }), recipients);
      }

      return data;
    }
    f().then((data = {}) => {
      this.output.data(data);
    }).catch(this.fallback);
  }



  async post_ticket() {
    let message = this.input.use(Attr.message, '');
    const thread_id = this.input.use(Attr.thread_id);
    let attachment = this.input.use(Attr.attachment, []);
    const ticket_id = this.input.need(Attr.ticket_id);
    const f = async () => {
      let input = {};
      let res = {};
      let ticket = await this.yp.await_proc('ticket_detail', ticket_id);

      if (isEmpty(ticket)) {
        res.status = 'INVALID_TICKET'
        return this.output.data(res);
      }
      let message_id = await this.yp.await_func("uniqueId");
      let sbox = await this._get_wicket(ticket.uid);

      if (!isEmpty(attachment)) {
        let desdir = await this.yp.await_proc('forward_proc', sbox.hub_id, 'mfs_make_dir', `'${sbox.ticket_id}','${stringify(message_id)}',1`)
        attachment = await this.move_attachemnt(sbox, desdir, attachment, message_id)
      }

      await this.yp.await_proc('forward_proc', sbox.hub_id, 'map_ticket_add', `'${message_id}','${ticket.ticket_id}'`)
      input.author_id = this.uid
      input.uid = this.uid
      input.message_id = message_id
      input.ticket_id = ticket.ticket_id;
      input.metadata = {}
      input.metadata.message_type = 'ticket'
      if (!isEmpty(attachment)) { input.attachment = attachment }
      if (!isEmpty(message)) { message = message.replace(/'/gi, "''"); }
      if (!isEmpty(thread_id)) { input.thread_id = thread_id }
      let data = await this.yp.await_proc('forward_proc', sbox.hub_id, 'channel_post_message_next', `'${stringify(input)}','${message}'`)
      data.is_attachment = 0
      if (!isEmpty(input.attachment)) {
        await this.yp.await_proc('forward_proc', sbox.hub_id, 'channel_post_attachment', `'${message_id}','${sbox.hub_id}','${stringify(input.attachment)}'`)
        data.is_attachment = 1
        // data.attachment = await this._getAttachmentsInfo(data.attachment, this.hub.get(Attr.id));
      }

      if (!isEmpty(thread_id)) {
        data.thread = await this.threadInfo(thread_id, sbox.hub_id)
      }

      data.ticket_id = ticket.ticket_id;
      data.echoId = this.input.get('echoId');
      //await this.notify_user(ticket.uid, data);
      let keys = { entity_id: Attr.hub_id };
      let recipients = await this.yp.await_proc('user_sockets', ticket.uid);
      await RedisStore.sendData(this.payload(data, { keys }), recipients);


      let support = await this.yp.call_proc('member_list_all', 'xxxxxxx', Cache.getSysConf('support_domain'));
      support = toArray(support);

      for (let member of support) {
        let recipients = await this.yp.await_proc('user_sockets', member.drumate_id);
        await RedisStore.sendData(this.payload(data, { keys }), recipients);

      }

      return data;

    }
    f().then((data = {}) => {
      this.output.data(data);
    }).catch(this.fallback);
  }


  /**
   * 
   */
  async post() {
    let message = this.input.use(Attr.message, '');
    const thread_id = this.input.use(Attr.thread_id);
    let attachment = this.input.use(Attr.attachment, []);
    let exclude = this.input.need(Attr.socket_id);
    if (exclude) exclude = [exclude];
    let input = {};
    let message_id = await this.db.await_proc('message_id');
    let sbox;
    message_id = message_id.id

    if (this.hub.get(Attr.id) == this.uid) {
      sbox = await this._get_wicket(this.uid);
    }
    else {
      sbox = await this.db.call_proc('mfs_home')
    }
    if (!isEmpty(attachment)) {
      let desdir = await this.yp.await_proc('forward_proc', sbox.hub_id, 'mfs_make_dir', `'${sbox.chat_id}','${stringify(message_id)}',1`)
      attachment = await this.move_attachemnt(sbox, desdir, attachment, message_id)
    }
    input.author_id = this.uid
    input.uid = this.uid

    if (!isEmpty(attachment)) { input.attachment = attachment }
    if (!isEmpty(message)) { message = message.replace(/'/gi, "''"); }
    if (!isEmpty(thread_id)) { input.thread_id = thread_id }
    input.message_id = message_id
    let data = await this.yp.await_proc('forward_proc', this.hub.get(Attr.id),
      'channel_post_message_next', `'${stringify(input)}','${message}'`
    );
    data.is_attachment = 0
    if (!isEmpty(input.attachment)) {
      await this.yp.await_proc('forward_proc', this.hub.get(Attr.id),
        'channel_post_attachment', `'${message_id}','${this.hub.get(Attr.id)}','${stringify(input.attachment)}'`
      );
      data.is_attachment = 1
    }

    if (!isEmpty(thread_id)) {
      data.thread = await this.threadInfo(thread_id, this.hub.get(Attr.id))
    }


    let profile = this.user.get('profile') || {};
    data.firstname = this.user.attributes.firstname;
    data.lastname = profile.lastname;
    data.hub_id = this.hub.get(Attr.id);

    data.echoId = this.input.get('echoId');
    let hub_id = this.hub.get(Attr.id);
    let recipients = await this.yp.await_proc('entity_sockets', { exclude, hub_id });
    await RedisStore.sendData(this.payload(data), recipients);

    this.output.data(data)
  }

  /**
   * Post a message to a share hub channel.
   * Supports both authenticated (yp.drumate) and anonymous (yp.dmz_user) authors.
   * message_id is generated server-side via message_id SP.
   */
  async write() {
    let message = this.input.use(Attr.message, '');
    const thread_id = this.input.use(Attr.thread_id);
    let attachment = this.input.use(Attr.attachment, []);
    const is_forward = this.input.use(Attr.is_forward, 0);
    const mention_ids = this.input.use('mention_ids', null);
    let exclude = this.input.need(Attr.socket_id);
    if (exclude) exclude = [exclude];

    let message_id = await this.db.await_proc('message_id');
    message_id = message_id.id;

    let sbox = await this.db.call_proc('mfs_home');
    if (!isEmpty(attachment)) {
      let desdir = await this.yp.await_proc('forward_proc', sbox.hub_id, 'mfs_make_dir', `'${sbox.chat_id}','${stringify(message_id)}',1`);
      attachment = await this.move_attachemnt(sbox, desdir, attachment, message_id);
    }

    if (!isEmpty(message)) { message = message.replace(/'/gi, "''"); }

    let data = await this.db.await_proc(
      'channel_write',
      this.uid,
      message_id,
      message,
      thread_id || null,
      !isEmpty(attachment) ? stringify(attachment) : null,
      is_forward,
      !isEmpty(mention_ids) ? stringify(mention_ids) : null
    );

    data.is_attachment = !isEmpty(attachment) ? 1 : 0;

    if (!isEmpty(thread_id)) {
      data.thread = await this.threadInfo(thread_id, this.hub.get(Attr.id));
    }

    data.hub_id = this.hub.get(Attr.id);
    data.echoId = this.input.get('echoId');

    let hub_id = this.hub.get(Attr.id);
    let recipients = await this.yp.await_proc('entity_sockets', { exclude, hub_id });
    await RedisStore.sendData(this.payload(data), recipients);

    // Track chat_initiated
    try {
      const track = await this.db.await_proc('share_track_add', 'chat_initiated', this.uid, null);
      const row = toArray(track)[0] || {};
      if (row.inserted) {
        const trackRecipients = await this.yp.await_proc('entity_sockets', { hub_id });
        await RedisStore.sendData(
          this.payload(
            { event: 'chat_initiated', actor_id: this.uid, firstname: row.firstname, lastname: row.lastname },
            { service: 'share.track_event' }
          ),
          trackRecipients
        );
      }
    } catch (e) {
      this.warn('[channel.write] chat_initiated tracking failed:', e && e.message);
    }

    this.output.data(data);
  }

  /**
  * Retrieve paginated notifications for the current user across all hubs.
  * Supports type filter (all / mention / share) and unread-only toggle.
  */
  async list_notifications() {
    const VALID_TYPES = ['all', 'mention', 'share'];
    let type = this.input.use(Attr.type, 'all');
    if (!VALID_TYPES.includes(type)) type = 'all';
    const unread_only = this.input.use('unread_only', 0) ? 1 : 0;
    const page = this.input.use(Attr.page, 1);
 
    // Get all active hubs owned by the current user
    let hubs = [];
    try {
      hubs = toArray(
        await this.yp.await_query(
          `SELECT id, db_name FROM entity
          WHERE owner_id = ? AND type = 'hub' AND status = 'active'`,
          this.uid
        )
      );
    } catch (e) {
      this.warn('[channel.list_notifications] hub list query failed:', e && e.message);
    }
 
    // Query channel_list_notifications per hub and aggregate results
    let all_notifications = [];
    for (const hub of hubs) {
      if (!hub.db_name) continue;
      try {
        const rows = toArray(
          await this.yp.await_proc(
            `${hub.db_name}.channel_list_notifications`,
            this.uid,
            type,
            unread_only,
            1
          )
        );
        // Tag each row with its hub_id
        for (const row of rows) {
          row.hub_id = hub.id;
          all_notifications.push(row);
        }
      } catch (e) {
        this.warn(`[channel.list_notifications] hub ${hub.id} query failed:`, e && e.message);
      }
    }
 
    // Sort merged results by ctime DESC then apply pagination
    all_notifications.sort((a, b) => b.ctime - a.ctime);
 
    const PAGE_SIZE = 45;
    const offset = (page - 1) * PAGE_SIZE;
    const paged = all_notifications.slice(offset, offset + PAGE_SIZE);
 
    this.output.list(paged);
  }

  // ========================
  // 
  // ========================
  read() {
    const id = this.input.use(Attr.id);
    this.db.call_proc('channel_read_messages', id, this.uid, this.output.data);
  }


  pages_to_read() {
    this.db.call_proc('pages_to_read', this.uid, this.output.data);
  }

  /**
   * 
   */
  async acknowledge() {
    const message_id = this.input.use(Attr.message_id);
    let exclude = this.input.need(Attr.socket_id);
    if (exclude) exclude = [exclude];

    let res = {};
    res = await this.db.await_proc('acknowledge_message', message_id, this.uid);
    let message = await this.db.await_proc('channel_get', message_id);
    message.key_id = this.hub.get(Attr.id);
    let recipients = await this.yp.await_proc('entity_sockets', {
      hub_id: message.key_id,
      exclude,
    });
    await RedisStore.sendData(this.payload(message), recipients);
    this.output.data(res);
  }



  /**
   * 
   */
  async acknowledge_ticket() {
    const message_id = this.input.use(Attr.message_id);
    const ticket_id = this.input.need(Attr.ticket_id);
    const f = async () => {
      let ticket = await this.yp.await_proc('ticket_detail', ticket_id);
      let sbox = await this.yp.await_proc('forward_proc', ticket.uid, 'mfs_wicket_home', `'${ticket.uid}'`);

      let res = {};
      res = await this.yp.await_proc('forward_proc', sbox.hub_id, 'acknowledge_message', `'${message_id}','${this.uid}'`);
      let message = await this.yp.await_proc('forward_proc', sbox.hub_id, 'channel_get', `'${message_id}'`);

      let support = await this.yp.call_proc('member_list_all', this.uid, Cache.getSysConf('support_domain'));
      support = toArray(support)
      for (let member of support) {
        message.service = "channel.acknowledge";
        let service = message.service;
        let recipients = await this.yp.await_proc('user_sockets', member.drumate_id);
        await RedisStore.sendData(this.payload(message, { service }), recipients);
      }

      let recipients = await this.yp.await_proc('user_sockets', this.uid);
      await RedisStore.sendData(this.payload(message), recipients);
      return this.output.data(res)

    }
    f().then((r) => {
      this.output.data(r);
    }).catch(this.fallback);
  }


  // ========================
  // 
  // ========================
  async clear_notifications() {
    //await this.notify_user(this.uid, {});
    let recipients = await this.yp.await_proc('user_sockets', this.uid);
    await RedisStore.sendData(this.payload({}), recipients);
    let data = await this.db.await_proc('channel_clear_notifications', this.uid);
    this.output.data(data);
  }

  /**
   * To create a RTC session Offer 
   * see : https://webrtc.org/getting-started/firebase-rtc-codelab
   * @params {object} as specified by https://www.w3.org/TR/webrtc/#rtcpeerconnection-interface
   */
  async createRTCOffer() {
    const offer = this.input.need('offer');
    const data = {
      callerId: this.uid,
      roomId: Crypto.randomBytes(32).toString("base64")
    }
    let recipients = await this.yp.await_proc('user_sockets', this.uid);
    await RedisStore.sendData(this.payload(data), recipients);
    this.output.data(data);
  }

  /**
   * 
   */
  async delete() {
    let option = this.input.need(Attr.option)
    let messages = this.input.need(Attr.messages)


    let res = {};
    let data = {};
    let temp_result = [];

    if (option != 'me' && option != 'all') {
      res.status = 'INVALID_OPTION'
      return this.output.data(res);
    }
    let invalid_messageid = 0;
    let invalid_option = 0;
    for (let message_id of messages) {
      data = await this.db.await_proc('channel_get', message_id);
      if (isEmpty(data)) {
        invalid_messageid = invalid_messageid + 1;
      }
      if (!isEmpty(data)) {
        if (option == 'all' && data.author_id != this.uid) {
          invalid_option = invalid_option + 1;
        }
      }
    }

    if (invalid_messageid > 0) {
      res.status = 'INVALID_MESSAGES'
      return this.output.data(res);
    }

    if (invalid_option > 0) {
      res.status = 'INVALID_OPTION'
      return this.output.data(res);
    }
    let result
    if (option == 'all') {
      result = await this.db.await_proc('channel_delete_hub_all', this.uid, option, stringify(messages));
    } else {
      result = await this.db.await_proc('channel_delete_hub_me', this.uid, option, stringify(messages));
    }
    data = result.shift() || [];
    data = toArray(data);
    for (let message of data) {

      if (!isEmpty(message.delete_attachment)) {
        message.delete_attachment = this.parseJSON(message.delete_attachment)
        for (let tempattach of message.delete_attachment) {
          let { nid, hub_id } = this.parseJSON(tempattach) || {};
          if (!nid || !hub_id) continue;
          let { home_dir } = await this.yp.await_proc('forward_proc', hub_id, 'mfs_home', ``)
          let src = { nid, hub_id, home_dir };
          await remove_node(src);
        }
      }

      temp_result.push(message);

      if (option == 'all') {
        let recipients = await this.yp.await_proc('entity_sockets', this.hub.get(Attr.id));
        await RedisStore.sendData(this.payload(message), recipients);
      }
    }
    data = result.shift()
    data = toArray(data);
    let service = "channel.roominfo";
    for (let msg of data) {
      let recipients = await this.yp.await_proc('user_sockets', msg.uid);
      await RedisStore.sendData(this.payload(msg, { service }), recipients);
    }
    this.output.list(temp_result);
  }

  /**
   * Save (pin) a notification for quick access.
   * Stores message_id + hub_id in notification_bookmark table (user DB).
   */
  async bookmark_add() {
    const message_id = this.input.need('message_id');
    const hub_id     = this.input.need('hub_id');
    const data = await this.db.await_proc('notification_bookmark_add', message_id, hub_id);
    this.output.data(data);
  }

  /**
   * Remove a pinned notification.
   */
  async bookmark_remove() {
    const message_id = this.input.need('message_id');
    const data = await this.db.await_proc('notification_bookmark_remove', message_id);
    this.output.data(data);
  }

  /**
   * List all bookmarked notifications for the current user.
   */
  async bookmark_list() {
    const page = this.input.use(Attr.page, 1);
    const data = await this.db.await_proc('notification_bookmark_list', page);
    this.output.list(data);
  }
}




module.exports = __private_channel;