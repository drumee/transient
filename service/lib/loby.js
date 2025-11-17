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
  sysEnv, uniqueId, Attr, toArray
} = require("@drumee/server-essentials");
const { Entity } = require("@drumee/server-core");
const { readFileSync } = require("fs");
const { template } = require("lodash");

class Account extends Entity {

  /**
   * The account schema is picked from the pool of hubs that are already created by offline process 
   */
  async create_account(data) {
    this.debug("AAA:30", data)
    const { main_domain: domain } = sysEnv();
    let {
      email,
      firstname = "",
      password,
    } = data;
    let username = firstname || email.split('@')[0];
    username = await this.yp.await_func("ensure_username", { username: username.toLowerCase(), domain });
    let a = firstname.split(/ +/)
    let lastname = "";
    if (a.length > 1) {
      firstname = a[0]
      a.shift()
      lastname = a.join(' ')
    }
    username = username.replace(/[^a-zA-Z0-9]/g, '');
    let profile = {
      username,
      sharebox: uniqueId(),
      otp: 0,
      category: "trial",
      profile_type: "trial",
      lang: this.user.language() || this.input.app_language(),
      firstname,
      lastname,
      email
    }

    let user = await this.yp.await_proc("drumate_create", password, profile);
    if (!user || !user[0]) {
      return { ...profile, error: 1, status: "unknown_error" }
    }

    if (user[0].failed) {
      return { ...profile, error: 1, status: "db_error", ...user[0] }
    }
    let { permission, failed } = user[0];
    let { drumate } = user[2] || {};
    if (drumate && permission) {
      try {
        let status = await this.session.signin({ email, password });
        return status;
      } catch (e) {
        this.warn("Auto login failed", e)
        return { error: 1, failed, status: "internal_error" }
      }
    }
    return { error: 1, failed, status: "unexpected_error" }
  }



  /**
   * 
   */
  getOAuthCode(provider) {
    const code = this.input.get(Attr.code);
    if (!code || !/^[A-Za-z0-9-_./]+$/.test(code)) {
      this.warn(`[Auth] Missing or invalid OAuth code from ${provider}`, Attr.code, code);
      this.output.data({ status: 'error', error: 'invalid_code' });
      return null
    }
    return code;
  }

  /** */
  async addUser(profile) {
    const { email, provider_id, provider, first_name, last_name, access_token, refresh_token } = profile;
    this.debug(`[Auth] addUser...`);
    let session_id = this.input.sid()

    // Double-check email doesn't exist
    let existingUser = await this.yp.await_proc('drumate_exists', email);
    if (existingUser && existingUser.email) {
      this.debug(`[Auth] Email ${email} exists but OAuth not linked`);
      return { status: 'error', error: 'user_exists' };
    }
    // Create new account
    const fullname = `${first_name} ${last_name}`.trim();
    const createData = {
      email: email,
      firstname: fullname || first_name,
      password: uniqueId() // OAuth users don't have password, set default
    };

    const creationResult = await this.create_account(createData) || {};
    if (!creationResult.user || creationResult.status !== 'ok') {
      this.warn(`[Auth] Failed to create account for ${email}:`, creationResult);
      return { status: 'error', error: 'account_creation_failed' };
    }

    this.debug(`[Auth] Account created for ${email}`, creationResult);

    // Get new user ID
    let newUser = await this.yp.await_proc('drumate_exists', email);
    if (!newUser || !newUser.id) {
      this.warn(`[Auth] Cannot find user ID after account creation`);
      throw new Error("Failed to get new user ID.");
    }
    const newUserId = newUser.id;
    this.debug(`[Auth] New user ID: ${newUserId}`);

    // Link OAuth account with rollback on failure
    try {
      await this.yp.await_query(
        'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, ctime, mtime, access_token, refresh_token) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), ?, ?)',
        newUserId, provider, provider_id, email, access_token, refresh_token
      );
    } catch (linkError) {
      this.warn(`[Auth] Failed to link OAuth. Rolling back...`, linkError.message);
      try {
        await this.yp.await_proc('drumate_delete', newUserId);
      } catch (rollbackError) {
        this.warn('[Auth] Rollback failed:', rollbackError);
      }
      throw new Error(`Failed to link OAuth account: ${linkError.message}`);
    }

    this.debug(`[Auth] OAuth account linked for user ${newUserId}, ${session_id}`);

    // Get full session data
    const domain_name = this.input.host();
    let finalSessionData = await this.yp.await_proc(
      'session_login_with_oauth',
      provider, provider_id, email, session_id, domain_name
    );
    finalSessionData = toArray(finalSessionData)[0];

    if (finalSessionData && finalSessionData.status === 'ok') {
      this.debug(`[Auth] Sign-up complete for ${email}`);
      return (finalSessionData);
    } else {
      this.warn(`[Auth] Failed to get session after sign-up:`, finalSessionData);
      return { status: 'error', error: 'session_fetch_failed' };
    }

  }

  /**
 * Handle OAuth callback for both Google and Apple
 */
  async handleOAuthCallback(profile) {
    try {

      const { email, provider_id, provider, access_token, refresh_token } = profile;
      const state = this.input.get(Attr.state);
      if (!state) {
        this.warn(`[Auth] Missing state parameter from ${provider}`);
        return { status: 'error', error: 'missing_state' };
      }

      const { validState } = await this.yp.await_query(
        'SELECT 1 validState FROM oauth_state WHERE state = ? AND ctime > UNIX_TIMESTAMP() - 600 LIMIT 1',
        state
      ) || {};

      if (!validState) {
        this.warn(`[Auth] Invalid or expired state: ${state}`);
        return { status: 'error', error: 'invalid_state' };
      }

      const session_id = this.input.sid()

      // Delete used state
      await this.yp.await_query('DELETE FROM oauth_state WHERE state = ?', state);

      const domain_name = this.input.host();
      this.debug(`[Auth] OAuth callback: email=${email}, provider=${provider}, provider_id=${provider_id}`);

      // Try to sign in
      let sessionData = await this.yp.await_proc(
        'session_login_with_oauth',
        provider, provider_id, email, session_id, domain_name
      );
      sessionData = toArray(sessionData)[0];

      // CASE A: Sign-in successful
      if (sessionData && sessionData.status === 'ok') {
        this.debug(`[Auth] Sign-in successful for ${email}`);
        await this.yp.await_query(
          'UPDATE oauth_accounts SET access_token = ?, refresh_token = ?, mtime = UNIX_TIMESTAMP() WHERE user_id = ? AND provider = ?',
          access_token, refresh_token, sessionData.id, provider
        );
        return sessionData;
      }

      // CASE B: Email exists but not linked
      if (sessionData && sessionData.error_code === 'oauth_not_linked') {
        this.debug(`[Auth] Email ${email} exists but not linked to ${provider}`);
        return {
          status: 'error',
          error: 'oauth_not_linked',
          message: sessionData.message,
          email
        };
      }

      // CASE C: New user - sign up
      if (sessionData && sessionData.error_code === 'oauth_user_not_found') {
        let res = await this.addUser(profile)
        return res;
      }

      this.warn(`[Auth] Unexpected OAuth callback result:`, sessionData);
      return { status: 'error', error: 'unexpected_error' };

    } catch (error) {
      this.warn(`[Auth] OAuth callback exception:`, error);
      throw error;
    }
  }


  /**
 *
 */
  async sendHtml(data, tpl) {
    const main_domain = sysEnv()
    let html = readFileSync(tpl);
    html = String(html).trim().toString();
    const content = template(html)(data);
    this.output.set_header(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
    this.output.set_header("Access-Control-Allow-Origin", `*.${main_domain}`);
    this.output.set_header("Pragma", "no-cache");
    this.output.html(content);
  }

}

module.exports = Account;
