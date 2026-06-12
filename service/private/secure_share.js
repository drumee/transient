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
  Attr, Cache, Messenger, RedisStore, toArray
} = require('@drumee/server-essentials');
const { Mfs } = require('@drumee/server-core');
const { isEmpty } = require('lodash');
const { shouldSendNotification } = require('../lib/email-policy');
const { hashPassword } = require('../lib/secure-share-password');

class __secure_share extends Mfs {

  /**
   * Create a secure share token for a file or folder.
   * v2: permission_level + allowed_emails array (null = public share, no email gate).
   * Backward compat: still accepts legacy email + domain_restriction fields.
   */
  async create() {
    const nid    = this.input.need(Attr.nid);
    const days   = this.input.get(Attr.days)  || 0;
    const hours  = this.input.get(Attr.hours) || 0;
    const expiryHours = (days * 24) + (hours * 1);

    const token    = this.randomString();
    const hub_id   = this.hub.get(Attr.id);
    const fullname = this.user.get('fullname');
    const lang     = this.user.language() || this.input.app_language();

    const VALID_LEVELS = ['can_view', 'can_download', 'can_chat', 'can_edit'];
    const rawLevel = (this.input.get('permission_level') || '').trim();
    const permissionLevel = VALID_LEVELS.includes(rawLevel) ? rawLevel : 'can_view';

    // v2 multi-select: an independent capability set (download/chat/edit). When
    // present it is the source of truth; the SP derives permission_level from it
    // for back-compat. Legacy single-select callers send only permission_level
    // and the SP derives the set from that. can_view is implicit (the baseline),
    // so we drop it from the stored set.
    const rawCaps = this.input.get('capabilities');
    const capabilities = Array.isArray(rawCaps)
      ? rawCaps.filter(c => VALID_LEVELS.includes(c) && c !== 'can_view')
      : undefined;

    const rawEmails = this.input.get('allowed_emails');
    const allowedEmails = (Array.isArray(rawEmails) && rawEmails.length > 0)
      ? rawEmails.map(e => String(e).toLowerCase().trim()).filter(Boolean)
      : undefined;
    // undefined → key omitted from JSON.stringify → SP reads SQL NULL → public share

    // v2: require_email is decoupled from allowed_emails. When set, viewers must
    // enter any email to access; an optional allowed_emails list further restricts
    // which emails are accepted. Sent as integer 1/0 (SP reads it via JSON_VALUE).
    const requireEmail = this.input.get('require_email') ? 1 : 0;

    // Notify the sender in real time when a recipient opens the share. Defaults
    // to ON (1) when the field is omitted, preserving the previous always-notify
    // behaviour. Coerced to integer 1/0 to avoid the JSON-bool→TINYINT trap.
    const notifyOnOpen = (this.input.get('notify_on_open') === 0 || this.input.get('notify_on_open') === false) ? 0 : 1;

    const rawPassword = this.input.get('password') || '';
    const passwordHash = rawPassword.trim() ? hashPassword(rawPassword.trim()) : '';

    const procArgs = {
      token,
      hub_id,
      node_id       : nid,
      creator_id    : this.uid,
      permission_level: permissionLevel,
      expiry_hours  : expiryHours,
      require_email : requireEmail,
      notify_on_open: notifyOnOpen,
      password_hash : passwordHash || null,
    };
    if (allowedEmails) procArgs.allowed_emails = allowedEmails;
    if (capabilities)  procArgs.capabilities  = capabilities;

    const row = await this.yp.await_proc('secure_share_create', procArgs);

    if (isEmpty(row)) {
      return this.output.data({ status: 'CREATE_FAILED' });
    }

    const host = this.hub.get(Attr.vhost);
    const link = `${this.input.homepath(host)}#/dmz/share/${token}`;

    // Send invitation email only when sharing with exactly one named recipient (not domain, not public)
    const singleEmail = allowedEmails && allowedEmails.length === 1
      && allowedEmails[0].includes('@') && !allowedEmails[0].startsWith('@')
      ? allowedEmails[0] : null;

    if (singleEmail && await shouldSendNotification(this.yp, singleEmail)) {
      try {
        const attr    = await this.db.await_proc('mfs_node_attr', nid) || {};
        const filesize = require('filesize');
        const subject  = Cache.message('_sent_you_files', lang).format(fullname, 1);
        const msg = new Messenger({
          template  : 'butler/outbound',
          subject   : `Drumee: ${subject}`,
          recipient : singleEmail,
          lex       : Cache.lex(lang),
          data      : {
            icon      : this.hub.get(Attr.icon),
            files     : [{ filename: attr.filename || '', filesize: filesize(attr.filesize || 0) }],
            subject   : Cache.message('_outbound_default_msg', lang).format(fullname),
            message   : '',
            recipient : singleEmail.replace(/@.+$/, ''),
            signature : fullname,
            link,
          },
          handler : this.exception.email
        });
        await msg.send();
      } catch (e) {
        this.warn('[secure_share.create] email send failed:', e && e.message);
      }
    }

    this.output.data({ ...row, link });
  }

  /**
   * List all secure share tokens created by the current user for a given node.
   */
  async list() {
    const nid    = this.input.need(Attr.nid);
    const hub_id = this.hub.get(Attr.id);
    const rows   = toArray(await this.yp.await_proc('secure_share_list', hub_id, nid, this.uid));
    const base   = this.input.homepath(this.hub.get(Attr.vhost));
    this.output.list(rows.map(r => ({ ...r, link: `${base}#/dmz/share/${r.id}` })));
  }

  /**
   * Revoke a secure share token (soft delete).
   * Broadcasts a real-time event so the recipient loses access immediately.
   */
  async revoke() {
    const token  = this.input.need(Attr.token);
    const hub_id = this.hub.get(Attr.id);

    const row = toArray(
      await this.yp.await_proc('secure_share_revoke', token, this.uid)
    )[0] || {};

    // Only broadcast if the revoke actually happened (procedure returns empty otherwise)
    if (!isEmpty(row) && row.revoked_at) {
      const eventData = {
        event           : 'secure_share_revoked',
        token,
        nid             : row.node_id,
        recipient_email : row.recipient_email,
      };
      const svcOpt = { service: 'share.track_event' };

      try {
        // Broadcast to hub members (sender's window refreshes its list)
        const recipients = await this.yp.await_proc('entity_sockets', { hub_id });
        await RedisStore.sendData(this.payload(eventData, svcOpt), recipients);
      } catch (e) {
        this.warn('[secure_share.revoke] hub broadcast failed:', e && e.message);
      }

      // Also target the recipient's socket directly using the socket_id stored at
      // access time — entity_sockets() won't include guest sockets.
      if (row.active_socket_id) {
        try {
          await RedisStore.sendData(
            this.payload(eventData, svcOpt),
            [{ socket_id: row.active_socket_id }]
          );
        } catch (e) {
          this.warn('[secure_share.revoke] recipient broadcast failed:', e && e.message);
        }
      }
    }

    this.output.data(row);
  }

  /**
   * Return the full share list for a node — same data as list(), used by the v2 panel.
   */
  async access_list() {
    const nid    = this.input.need(Attr.nid);
    const hub_id = this.hub.get(Attr.id);
    const rows   = toArray(await this.yp.await_proc('secure_share_list', hub_id, nid, this.uid));
    const base   = this.input.homepath(this.hub.get(Attr.vhost));
    this.output.list(rows.map(r => ({ ...r, link: `${base}#/dmz/share/${r.id}` })));
  }

  /**
   * Hard-delete a token. Only allowed when it is already revoked or expired.
   */
  async delete() {
    const token = this.input.need(Attr.token);
    const res   = toArray(
      await this.yp.await_proc('secure_share_delete', token, this.uid)
    )[0] || {};
    this.output.data(res);
  }

  /**
   * Approve or deny a pending secure share access request.
   * Caller must be the share creator. Notifies the guest and broadcasts to hub.
   */
  async respond_to_access_request() {
    const VALID_ACTIONS = ['approve', 'deny'];
    const VALID_LEVELS  = ['can_view', 'can_download', 'can_chat', 'can_edit'];
    // CUMULATIVE privilege masks, consistent with dmz._loginSecureShare: can_chat
    // carries NO download bit (it is gated by the can_chat flag, not the bitmask).
    const LEVEL_TO_PRIVILEGE = { can_view: 3, can_download: 7, can_chat: 3, can_edit: 15 };

    const requestId    = this.input.need('request_id');
    const action       = (this.input.get('action') || '').trim();
    const grantedLevel = (this.input.get('granted_level') || '').trim() || null;

    if (!VALID_ACTIONS.includes(action)) {
      return this.output.data({ status: 'INVALID_ACTION' });
    }
    if (action === 'approve' && (!grantedLevel || !VALID_LEVELS.includes(grantedLevel))) {
      return this.output.data({ status: 'INVALID_LEVEL' });
    }

    const row = toArray(
      await this.yp.await_proc(
        'secure_share_respond_to_access_request',
        requestId, this.uid, action, grantedLevel || ''
      )
    )[0] || {};

    if (!row.id || row.error) {
      return this.output.data({ status: row.error || 'INVALID_REQUEST' });
    }

    // On approval, grant the requester workspace membership with the granted
    // capability. Best-effort: a failure here must not block the response or the
    // notifications below.
    if (action === 'approve') {
      try {
        await this._grantHubMembership(row);
      } catch (e) {
        this.warn('[secure_share.respond] membership grant failed:', e && e.message);
      }
    }

    // Notify the guest's socket directly
    if (row.guest_socket_id) {
      try {
        await RedisStore.sendData(
          this.payload(
            {
              event         : 'secure_share_access_responded',
              request_id    : row.id,
              action,
              granted_level : row.granted_level,
              privilege     : LEVEL_TO_PRIVILEGE[row.granted_level] || 3,
              capabilities  : (row.granted_level && row.granted_level !== 'can_view') ? [row.granted_level] : [],
              can_download  : row.granted_level === 'can_download' ? 1 : 0,
              can_chat      : row.granted_level === 'can_chat' ? 1 : 0,
              can_edit      : row.granted_level === 'can_edit' ? 1 : 0,
            },
            { service: 'share.track_event' }
          ),
          [{ socket_id: row.guest_socket_id }]
        );
      } catch (e) {
        this.warn('[secure_share.respond] guest notify failed:', e && e.message);
      }
    }

    // Broadcast to all hub members so the sender window can refresh
    try {
      const hub_id = this.hub.get(Attr.id);
      const recipients = await this.yp.await_proc('entity_sockets', { hub_id });
      await RedisStore.sendData(
        this.payload(
          { event: 'secure_share_access_responded', request_id: row.id, action },
          { service: 'share.track_event' }
        ),
        recipients
      );
    } catch (e) {
      this.warn('[secure_share.respond] hub broadcast failed:', e && e.message);
    }

    return this.output.data({
      ...row,
      status: action === 'approve' ? 'APPROVED' : 'DENIED',
    });
  }

  /**
   * Grant the approved requester membership of the shared workspace.
   * Mirrors signup._resolve_pending_invitation:
   *  - existing account  → add_member + permission_grant + WS notify (desk sidebar)
   *  - no account yet    → queue a pending_invitation so signup adds them later
   * The granted_level maps to the same cumulative privilege masks used elsewhere
   * in the secure-share flow (can_chat carries no download bit).
   * @param {object} row  the row returned by secure_share_respond_to_access_request
   */
  async _grantHubMembership(row) {
    const LEVEL_TO_PRIVILEGE = { can_view: 3, can_download: 7, can_chat: 3, can_edit: 15 };
    const privilege = LEVEL_TO_PRIVILEGE[row.granted_level] || 3;
    const hub_id    = row.hub_id;
    const email     = (row.requester_email || '').toLowerCase().trim();
    if (!hub_id || !email) return;

    const db_name = await this.yp.await_func('get_db_name', hub_id);
    if (!db_name) return;

    let member = await this.yp.await_proc('drumate_exists', email);
    if (Array.isArray(member)) member = member[0];
    const uid = member && member.id ? member.id : null;

    // No account yet — queue a pending invitation; signup._resolve_pending_invitation
    // will add them to the hub with this privilege when they register.
    if (!uid) {
      await this.yp.await_proc('yp_add_pending_invitation', hub_id, 0, privilege, email);
      return;
    }

    // Existing user — add to the hub now (same calls as signup-time invite resolution).
    await this.yp.await_proc(`${db_name}.add_member`, uid, privilege, 0);
    await this.yp.await_proc(
      `${db_name}.permission_grant`,
      '*', uid, 0, privilege, 'system', 'Secure share access approved'
    );

    // Notify the (now member) user so their desk sidebar picks up the workspace.
    try {
      let hub = await this.yp.await_proc(`${db_name}.mfs_access_node`, uid, hub_id);
      if (Array.isArray(hub)) hub = hub[0];
      if (hub) {
        hub.ownpath = '/';
        hub.hub_id  = hub.actual_hub_id;
        hub.db_name = hub.actual_db;
        const sockets = await this.yp.await_proc('user_sockets', uid);
        await RedisStore.sendData(this.payload(hub, { service: 'hub.invite_received' }), sockets);
        await RedisStore.sendData(this.payload(hub, { service: 'hub.add_contributors' }), sockets);
      }
    } catch (err) {
      this.warn('[secure_share.respond] member WS notify failed:', err && err.message);
    }
  }

}

module.exports = __secure_share;
