// service/register.js

const { toArray, Attr, Cache, sysEnv } = require('@drumee/server-essentials');
const { resolve } = require('path');
const { Messenger } = require('@drumee/server-core');
const { readFileSync: readJson } = require('jsonfile');
const { readFileSync } = require('fs');
const { OAuth2Client } = require('google-auth-library');
const __butler = require('./butler.js');

class Register extends __butler {
  initialize(opt) {
    super.initialize(opt);

    try {
      const { credential_dir } = sysEnv();

      // Load Google credentials
      let gkey = resolve(credential_dir, `google/info.json`);
      const { id, secret } = readJson(gkey);

      if (id && secret) {
        this.googleClient = new OAuth2Client(
          id,
          secret,
          `${this.input.host()}/auth/google/callback`
        );
        this.googleClientId = id;
        this.debug("[Auth] Google Credentials loaded.");
      } else {
        this.warn("[Auth] CRITICAL: Failed to load Google credentials.");
      }

      // Load Apple credentials
      let akey = resolve(credential_dir, `apple/info.json`);
      const { team_id, service_id, key_id } = readJson(akey);
      let pkey = resolve(credential_dir, `apple`, `${key_id}.p8`);
      const private_key = readFileSync(pkey, 'utf8');

      if (team_id && service_id && key_id && private_key) {
        this.appleCreds = {
          team_id,
          service_id,
          key_id,
          private_key
        };
        this.debug("[Auth] Apple Credentials loaded.");
      } else {
        this.warn("[Auth] CRITICAL: Failed to load Apple credentials.");
      }

    } catch (e) {
      this.warn("[Auth] CRITICAL: Failed to load OAuth credentials!", e.message);
    }
  }

  /**
   * Mock OAuth profile for testing
   */
  async _getMockOAuthProfile(provider, code) {
    this.debug(`[Auth] Code '${code}' received from ${provider}. USING MOCK DATA.`);
    const timestamp = Date.now().toString().slice(-6);
    return {
      email: `user.${timestamp}@${provider}-mock.com`,
      provider_id: `${provider}-id-${timestamp}`,
      first_name: provider === 'google' ? 'GoogleUser' : 'AppleUser',
      last_name: 'Test',
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token'
    };
  }

  /**
   * Main OAuth callback handler for both Google and Apple
   */
  async _handleOAuthCallback(provider) {
    try {
      const code = this.input.get(Attr.code);
      if (!code) {
        this.warn(`[Auth] Missing OAuth code from ${provider}`);
        return this.output.data({
          status: 'error',
          error: 'missing_code',
          message: 'Authorization code is missing.'
        });
      }
      // SWITCH HERE: Comment/uncomment to toggle mock vs real
      // const profile = await this._getMockOAuthProfile(provider, code);  // MOCK
      const profile = provider === 'google'
        ? await this._getGoogleProfile(code)   // REAL GOOGLE
        : await this._getAppleProfile(code);    // REAL APPLE

      const { email, provider_id, first_name, last_name, access_token, refresh_token } = profile;

      const session_id = this.input.sid();
      const domain_name = this.input.host();

      this.debug(`[Auth] OAuth callback: email=${email}, provider=${provider}, provider_id=${provider_id}`);

      let sessionData = await this.yp.await_proc(
        'session_login_with_oauth',
        provider,
        provider_id,
        email,
        session_id,
        domain_name
      );
      sessionData = toArray(sessionData)[0];

      if (sessionData && sessionData.status === 'ok') {
        this.debug(`[Auth] ✓ Sign-in successful for ${email}`);

        await this.yp.await_query(
          `UPDATE oauth_accounts 
           SET access_token = ?, refresh_token = ?, mtime = UNIX_TIMESTAMP() 
           WHERE user_id = ? AND provider = ?`,
          access_token, refresh_token, sessionData.id, provider
        );

        return this.output.data(sessionData);
      }

      if (sessionData && sessionData.error_code === 'oauth_not_linked') {
        this.debug(`[Auth] ⚠ Email ${email} exists but not linked to ${provider}`);
        return this.output.data({
          status: 'error',
          error: 'oauth_not_linked',
          message: 'This email is already registered. Please sign in with password first, then link your OAuth account in settings.',
          email: email
        });
      }

      if (sessionData && sessionData.error_code === 'oauth_user_not_found') {
        this.debug(`[Auth] User ${email} not found. Starting sign-up flow...`);

        let existingUser = await this.yp.await_proc("drumate_exists", email);
        if (existingUser && existingUser.email) {
          this.debug(`[Auth] ⚠ Email ${email} already exists but OAuth not linked`);
          return this.output.data({
            status: 'error',
            error: 'user_exists',
            message: 'This email is already registered. Please sign in with password.',
            email: email
          });
        }

        const fullname = `${first_name} ${last_name}`.trim();
        const createData = {
          email: email,
          firstname: fullname || first_name,
          password: `oauth_${provider}_${Date.now()}`
        };

        const creationResult = await this._create_account(createData);

        if (creationResult.error !== 0 || creationResult.status !== 'ok') {
          this.warn(`[Auth] ✗ Failed to create account for ${email}:`, creationResult);
          return this.output.data({
            status: 'error',
            error: 'account_creation_failed',
            message: `Failed to create account: ${creationResult.status || 'unknown_error'}`,
            details: creationResult
          });
        }

        this.debug(`[Auth] ✓ Account created successfully for ${email}`);

        const newUserId = this.session.uid();
        if (!newUserId) {
          this.warn(`[Auth] ✗ Cannot find user ID after account creation`);
          return this.output.data({
            status: 'error',
            error: 'missing_user_id',
            message: 'Failed to retrieve user ID after account creation.'
          });
        }

        await this.yp.await_query(
          `INSERT INTO oauth_accounts 
           (user_id, provider, provider_user_id, email, access_token, refresh_token, ctime, mtime) 
           VALUES (?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())`,
          newUserId,
          provider,
          provider_id,
          email,
          access_token,
          refresh_token
        );

        this.debug(`[Auth] ✓ OAuth account linked: user_id=${newUserId}, provider=${provider}`);

        let finalSessionData = await this.yp.await_proc(
          'session_login_with_oauth',
          provider,
          provider_id,
          email,
          session_id,
          domain_name
        );
        finalSessionData = toArray(finalSessionData)[0];

        if (finalSessionData && finalSessionData.status === 'ok') {
          this.debug(`[Auth] ✓ Sign-up complete for ${email}`);
          return this.output.data(finalSessionData);
        } else {
          this.warn(`[Auth] ✗ Failed to fetch session after sign-up:`, finalSessionData);
          return this.output.data({
            status: 'error',
            error: 'session_fetch_failed',
            message: 'Account created but failed to log in automatically.',
            details: finalSessionData
          });
        }
      }

      this.warn(`[Auth] ✗ Unexpected error during OAuth callback:`, sessionData);
      return this.output.data({
        status: 'error',
        error: 'unexpected_error',
        message: 'An unexpected error occurred during authentication.',
        details: sessionData
      });

    } catch (error) {
      this.warn(`[Auth] ✗ Exception in OAuth callback:`, error);
      return this.output.data({
        status: 'error',
        error: 'exception',
        message: error.message || 'An error occurred during OAuth authentication.'
      });
    }
  }

  async google_start() {
    try {
      if (!this.googleClient) {
        return this.output.data({
          status: 'error',
          error: 'credentials_missing',
          message: 'Google OAuth credentials not configured.'
        });
      }

      const authUrl = this.googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        prompt: 'consent'
      });

      this.debug('[Auth] Returning Google OAuth URL:', authUrl);

      this.output.data({
        success: true,
        status: 'prompt',
        authUrl: authUrl
      });

    } catch (error) {
      this.warn('[Auth] Error initiating Google OAuth:', error);
      return this.output.data({
        status: 'error',
        error: 'oauth_init_failed',
        message: error.message
      });
    }
    this.output.data(sessionData)
  }

  /**
   * 
   * @returns 
   */
  async apple_start() {
    try {
      if (!this.appleCreds) {
        return this.output.data({
          status: 'error',
          error: 'credentials_missing',
          message: 'Apple OAuth credentials not configured.'
        });
      }

      const creds = this.appleCreds;
      const state = Math.random().toString(36).substring(2, 15);

      // Store state in session for CSRF protection
      // TODO: Store in Redis/DB if needed for production

      const authUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent(creds.service_id)}` +
        `&redirect_uri=${encodeURIComponent(creds.redirect_uri)}` +
        `&response_type=code` +
        `&response_mode=form_post` +
        `&scope=name email` +
        `&state=${state}`;

      this.debug('[Auth] Returning Apple OAuth URL:', authUrl);

      this.output.data({
        success: true,
        status: 'prompt',
        authUrl: authUrl,
        state: state
      });

    } catch (error) {
      this.warn('[Auth] Error initiating Apple OAuth:', error);
      return this.output.data({
        status: 'error',
        error: 'oauth_init_failed',
        message: error.message
      });
    }
  }

  async google_callback() {
    return this._handleOAuthCallback('google');
  }

  async apple_callback() {
    return this._handleOAuthCallback('apple');
  }

}

module.exports = Register;