// service/onboarding.js

const { Entity } = require('@drumee/server-core');
const { toArray, Cache, Constants, Attr, Messenger } = require('@drumee/server-essentials');
const { resolve } = require('path');
const { ID_NOBODY } = Constants;
class Onboarding extends Entity {

  initialize(opt) {
    super.initialize(opt);
    this.conf = Cache.getSysConf('ob_conf');
    let { db_name } = JSON.parse(this.conf);
    this.app_db = db_name;
    console.log("Onboarding Service Initialized.  Config:", db_name, this.conf);
  }

  // Session ID
  _getSessionId() {
    const sessionId = this.input.sid();
    if (!sessionId) {
      console.error('[ONBOARDING ERROR] this.input.sid() returned null or undefined.');
      throw new Error("Session ID not found.");
    }
    return sessionId;
  }

  /**
   * 
   */
  async get_env() {
    console.log("[ONBOARDING] get_env called. Returning config:", this.conf);
    this.output.data(this.conf || {});
  }

  /**
   * 
   */
  async save_signup_info() {
    const sessionId = this.input.sid();
    const email = this.input.need(Attr.email);

    // Call SP
    await this.db.await_proc(
      `${this.app_db}.save_signup_info`,
      sessionId, email
    );
    this.output.data({ success: true, message: 'User info saved.', data: {} });
  }

  /**
   * 
   */
  async save_user_info() {
    const sessionId = this.input.sid();
    const firstName = this.input.need(Attr.firstname);
    const lastName = this.input.need(Attr.lastname);
    const email = this.input.need(Attr.email);
    const countryCode = this.input.need('country_code');

    // Basic Validation
    if (!firstName || !lastName || !email || !countryCode) {
      return this.exception.user("Missing required user info fields.")
      // throw new Error("Missing required user info fields.");
    }

    // Call SP
    await this.db.await_proc(
      `${this.app_db}.save_onboarding_user_info`,
      sessionId, firstName, lastName, email, countryCode
    );
    this.output.data({ success: true, message: 'User info saved.', data: {} });
  }

  /**
   * 
   */
  async reset() {
    this.output.clearAuthorization(this.input.authorization());
    this.output.data({});
  }

  /**
   * 
   */
  async get_countries() {
    const requestedLocale = this.input.get('locale_code') || this.session?.locale || 'en_US';

    let countriesListRaw;
    try {
      countriesListRaw = await this.db.await_proc(
        `${this.app_db}.get_countries`,
        requestedLocale
      );
    } catch (spError) {
      console.error(`[ONBOARDING ERROR] Error calling get_countries SP: ${spError.message}`);
      throw spError;
    }

    const countriesList = toArray(countriesListRaw);

    this.output.data({
      success: true,
      data: countriesList
    });
  }

  /**
   * Step 2: Save team type selection.
   * Valid values: personal | startup | enterprise
   */
  async save_usage_plan() {
    const sessionId = this.input.sid();
    const usagePlan = this.input.need(Attr.args);

    const VALID_PLANS = ['personal', 'startup', 'enterprise'];
    if (!VALID_PLANS.includes(usagePlan)) {
      return this.exception.user(
        'Invalid usage plan. Must be one of: personal, startup, enterprise.'
      );
    }

    await this.db.await_proc(
      `${this.app_db}.save_onboarding_usage_plan`,
      sessionId, usagePlan
    );
    this.output.data({ success: true, message: 'Usage plan saved.', data: {} });
  }

  /**
   * 
   */
  async save_tools() {
    const sessionId = this.input.sid();
    const currentTools = this.input.need(Attr.args);

    // Call SP
    await this.db.await_proc(
      `${this.app_db}.save_onboarding_tools`,
      sessionId, currentTools
    );

    this.output.data({ success: true, message: 'Tools saved.', data: {} });
  }

  /**
   * 
   */
  async save_privacy() {
    const sessionId = this.input.sid();
    const privacyLevel = this.input.need('privacy');

    const level = parseInt(privacyLevel);
    if (isNaN(level) || level < 1 || level > 5) {
      return this.exception.user("Privacy level must be between 1 and 5.")
    }
    // Call SP
    await this.db.await_proc(
      `${this.app_db}.save_onboarding_privacy`,
      sessionId, level
    );

    this.output.data({ success: true, message: 'Privacy level saved.', data: {} });
  }

  /**
   * 
   */
  async check_completion() {
    const sessionId = this.input.sid();
    let completionStatusRaw;

    try {
      completionStatusRaw = await this.db.await_proc(`${this.app_db}.check_onboarding_completion`, sessionId);
    } catch (spError) {
      console.error(`[ONBOARDING ERROR] Error calling check_completion SP for session ${sessionId}: ${spError.message}`);
      throw spError;
    }

    let completionStatus = toArray(completionStatusRaw)[0] || {
      // Return a default structure if SP returns nothing (user not started)
      session_id: sessionId,
      is_completed: false,
      status: 'not_started',
      steps_completed: null // Match SP output when not started
    };

    this.output.data({ success: true, data: completionStatus });
  }

  /**
   * 
   */
  async mark_complete() {
    const sessionId = this.input.sid();

    try {
      await this.db.await_proc(`${this.app_db}.mark_onboarding_complete`, sessionId);
    } catch (spError) {
      console.error(`[ONBOARDING ERROR] Error calling mark_complete SP for session ${sessionId}: ${spError.message}`);
      throw spError;
    }

    this.output.data({ success: true, message: 'Onboarding marked as complete (validated).', data: {} });
  }

  /**
   * 
   */
  async update_profile() {
    const { email } = this.user.get(Attr.profile);
    this.debug("AAA:204", this.user.get(Attr.profile))
    if (!this.uid === ID_NOBODY) {
      return this.output.data({ status: "no-user" });
    }
    const sql = `SELECT * FROM ${this.app_db}.onboarding_responses WHERE email=? ORDER BY mtime DESC LIMIT 1`;
    const { firstname, lastname, country_code }
      = await this.yp.await_query(sql, email) || {};
    this.debug("AAA:210", { firstname, lastname, country_code, email })
    this.yp.await_proc('drumate_update_profile', this.uid, { onboarded: 1, firstname, lastname, country_code })
    this.output.data({ firstname, lastname, country_code });
  }

  /**
   * 
   * @returns 
   */
  async get_response() {
    const sessionId = this.input.sid();
    let responseDataRaw;
    let { xlink } = JSON.parse(this.conf);
    try {
      responseDataRaw = await this.db.await_proc(`${this.app_db}.get_onboarding_response`, sessionId);
    } catch (spError) {
      console.error(`[ONBOARDING ERROR] Error calling get_response SP for session ${sessionId}: ${spError.message}`);
      throw spError;
    }

    let responseData = toArray(responseDataRaw)[0] || null;

    if (!responseData) {
      this.output.data({ xlink });
      return;
    }

    // Parse JSON tools
    if (responseData.current_tools && typeof responseData.current_tools === 'string') {
      try {
        responseData.current_tools = JSON.parse(responseData.current_tools);
      } catch (e) {
        this.warn("Failed to parse current_tools JSON for session:", sessionId);
        responseData.current_tools = [];
      }
    }
    this.conf = Cache.getSysConf('ob_conf');
    responseData.xlink = xlink;
    this.output.data(responseData);
  }

  /**
   * Step 3: Generate shareable referral signup link for the current user.
   * Fetches or generates the user's referral code from C_reward,
   * then returns the full signup URL.
   *
   * NOTE: Calls reward_get_referral_code cross-DB via this.db.
   * If loby's DB user lacks EXECUTE on C_reward, switch to this.yp.await_proc(...).
   */
  async get_onboarding_invite_link() {
    if (!this.uid) {
      return this.exception.user('User not authenticated.');
    }

    const rewardConf = JSON.parse(Cache.getSysConf('reward_hub_conf') || '{}');
    const reward_db = rewardConf.db_name;
    if (!reward_db) {
      return this.exception.user('Reward hub not configured.');
    }

    const result = await this.db.await_proc(
      `${reward_db}.reward_get_referral_code`,
      this.uid
    );

    const rows = toArray(result);
    const row = rows[0] || {};

    if (!row.referral_code || row.status === 'failed') {
      return this.exception.user('Failed to get referral code.');
    }

    const homepath = this.input.homepath();
    const referral_url = `${homepath}#/welcome/signup?ref=${encodeURIComponent(row.referral_code)}`;

    this.output.data({
      referral_code: row.referral_code,
      referral_url
    });
  }

  /**
   * Step 3: Send invite emails to a list of email addresses.
   * Each email receives a referral signup link tied to the current user.
   * Invite tracking is handled automatically when the invitee signs up using the referral code (via reward_save_referral in signup flow).
   *
   * NOTE: cross-DB call to C_reward via this.db.
   * If loby DB user lacks EXECUTE on C_reward, switch to this.yp.await_proc(...).
   */
  async send_onboarding_invites() {
    if (!this.uid) {
      return this.exception.user('User not authenticated.');
    }

    const emails = toArray(this.input.need('emails'));
    if (!emails.length) {
      return this.exception.user('No emails provided.');
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter(e => !EMAIL_RE.test(String(e).trim()));
    if (invalid.length) {
      return this.exception.user(`Invalid email address(es): ${invalid.join(', ')}`);
    }

    const rewardConf = JSON.parse(Cache.getSysConf('reward_hub_conf') || '{}');
    const reward_db = rewardConf.db_name;
    if (!reward_db) {
      return this.exception.user('Reward hub not configured.');
    }

    // Get or generate inviter's referral code from C_reward
    const result = await this.db.await_proc(
      `${reward_db}.reward_get_referral_code`,
      this.uid
    );
    const rows = toArray(result);
    const row = rows[0] || {};

    if (!row.referral_code || row.status === 'failed') {
      return this.exception.user('Failed to get referral code.');
    }

    const homepath = this.input.homepath();
    const referral_url = `${homepath}#/welcome/signup?ref=${encodeURIComponent(row.referral_code)}`;
    const tpl = resolve(__dirname, './templates/onboarding-invite.html');
    let sent = 0;

    for (const email of emails) {
      const data = {
        heading: 'You have been invited to Drumee',
        hello: 'Hello,',
        message: 'Your colleague has invited you to join Drumee — a sovereign workspace for files, chat, and collaboration.',
        link: referral_url,
        workspace: 'Join Drumee',
        signature: 'The Drumee Team',
        reminder: `© ${new Date().getFullYear()} Drumee. All rights reserved.`,
      };

      const msg = new Messenger({
        subject: 'You have been invited to Drumee',
        recipient: email.trim(),
        handler: this.exception.email,
      });

      try {
        const html = msg.renderFrom(tpl, data);
        await msg.send({ html });
        sent++;
      } catch (e) {
        this.warn(`[send_onboarding_invites] Failed to send to ${email}:`, e && e.message);
      }
    }

    this.output.data({ success: true, sent });
  }

  /**
  * Get activation status for the current user.
  * Events tracked via yp.services_log for:
  *   - workspace_created  → desk.create_hub
  *   - teammate_invited   → onboarding.send_onboarding_invites
  * Events tracked via direct hub DB query for:
  *   - first_file_uploaded → media table (high-frequency, not suitable for services_log)
  *   - folder_chat_started → channel table (high-frequency, not suitable for services_log)
  */
  async get_activation_status() {
    if (!this.uid) {
      return this.output.data({
        workspace_created: false,
        first_file_uploaded: false,
        teammate_invited: false,
        folder_chat_started: false
      });
    }

    // Query services_log for low-frequency logged events
    let logged = new Set();
    try {
      const raw = toArray(
        await this.yp.await_query(
          `SELECT DISTINCT name FROM services_log WHERE uid = ? AND name IN (?, ?)`,
          this.uid,
          'desk.create_hub',
          'onboarding.send_onboarding_invites'
        )
      );
      logged = new Set(raw.map(r => r.name));
    } catch (e) {
      this.warn('[get_activation_status] services_log query failed:', e && e.message);
    }

    // Query hub DB directly for high-frequency events
    let first_file_uploaded = false;
    let folder_chat_started = false;

    try {
      const hubRow = toArray(
        await this.yp.await_query(
          `SELECT db_name FROM entity WHERE owner_id = ? AND type = 'hub' AND area = 'private' LIMIT 1`,
          this.uid
        )
      )[0];

      if (hubRow && hubRow.db_name) {
        const db = hubRow.db_name;

        const fileRow = toArray(
          await this.yp.await_query(
            `SELECT 1 AS found FROM ${db}.media WHERE owner_id = ? AND category NOT IN ('folder', 'hub', 'root') LIMIT 1`,
            this.uid
          )
        )[0];
        first_file_uploaded = !!fileRow;

        const chatRow = toArray(
          await this.yp.await_query(
            `SELECT 1 AS found FROM ${db}.channel WHERE author_id = ? LIMIT 1`,
            this.uid
          )
        )[0];
        folder_chat_started = !!chatRow;
      }
    } catch (e) {
      this.warn('[get_activation_status] Hub DB query failed:', e && e.message);
    }

    this.output.data({
      workspace_created: logged.has('desk.create_hub'),
      first_file_uploaded,
      teammate_invited: logged.has('onboarding.send_onboarding_invites'),
      folder_chat_started
    });
  }
}

module.exports = Onboarding;