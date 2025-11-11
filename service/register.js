// service/register.js

const { Entity } = require('@drumee/server-core');
const { toArray, Attr, sysEnv } = require('@drumee/server-essentials');
const { toArray, Attr, Cache, sysEnv } = require('@drumee/server-essentials');
const { resolve } = require('path');
const { Messenger } = require('@drumee/server-core');
const { readFileSync: readJson } = require('jsonfile');
const { readFileSync } = require('fs');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');
const { randomUUID } = require('crypto');
const __butler = require('./butler.js');

class Register extends __butler {
  initialize(opt) {
    super.initialize(opt);

    this.appleJwksClient = jwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: 'https://appleid.apple.com/auth/keys'
    });

    this.appleClientSecret = null;
    this.appleClientSecretExp = 0;

    try {
      const { credential_dir } = sysEnv();

      // Load Google credentials
      const gkey = resolve(credential_dir, `google/info.json`);
      const gCreds = readJson(gkey);

      if (gCreds && gCreds.id && gCreds.secret && gCreds.redirect_uri) {
        this.googleCreds = gCreds;
        this.googleClient = new OAuth2Client(
          gCreds.id, gCreds.secret, gCreds.redirect_uri
      let gkey = resolve(credential_dir, `google/info.json`);
      const { id, secret } = readJson(gkey);
      const { svc_location} = sysEnv();
      if (id && secret) {
        this.googleClient = new OAuth2Client(
          id,
          secret,
          `https://${this.input.host()}${svc_location}/register.google_callback`
        );
        this.googleClientId = gCreds.id;
        this.debug("[Auth] Google Credentials loaded.");
      } else {
        this.warn("[Auth] CRITICAL: Failed to load 'google/info.json'.");
      }

      // Load Apple credentials
      const akey = resolve(credential_dir, `apple/info.json`);
      const aCreds = readJson(akey);
      const pkey = resolve(credential_dir, `apple`, `${aCreds.key_id}.p8`);
      const private_key = readFileSync(pkey, 'utf8');

      if (aCreds && aCreds.team_id && aCreds.service_id && aCreds.key_id && private_key && aCreds.redirect_uri) {
      if (team_id && service_id && key_id && private_key) {
        this.appleCreds = {
          team_id: aCreds.team_id,
          service_id: aCreds.service_id,
          key_id: aCreds.key_id,
          private_key: private_key,
          redirect_uri: aCreds.redirect_uri
        };
        this.debug("[Auth] Apple Credentials loaded.");
      } else {
        this.warn("[Auth] CRITICAL: Failed to load Apple credentials.");
      }
    } catch (e) {
      this.warn("[Auth] CRITICAL: Failed to load OAuth credentials!", e.message);
    }
  }

  _getAppleClientSecret() {
    const now = Math.floor(Date.now() / 1000);
    if (this.appleClientSecret && now < this.appleClientSecretExp) {
      return this.appleClientSecret;
    }

    this.debug("[Auth] Generating new Apple Client Secret...");
    const creds = this.appleCreds;
    if (!creds || !creds.private_key) {
      throw new Error("Apple credentials or private key content not loaded.");
    }

    const iat = now;
    const exp = iat + (60 * 4);
    const claims = {
      iss: creds.team_id,
      aud: 'https://appleid.apple.com',
      sub: creds.service_id,
      iat: iat,
      exp: exp
    };
    this.appleClientSecret = jwt.sign(claims, creds.private_key, {
    return jwt.sign(claims, creds.private_key, {
      algorithm: 'ES256',
      keyid: creds.key_id
    });
    this.appleClientSecretExp = exp;

    return this.appleClientSecret;
  }

  async _getGoogleProfile(code) {
    if (!this.googleClient) {
      throw new Error("Google credentials are not loaded.");
    }

    const { tokens } = await this.googleClient.getToken(code);
    const id_token = tokens.id_token;

    if (!id_token) {
      throw new Error("Failed to retrieve ID Token from Google.");
    }

    if (!this.googleClient) { throw new Error("Google credentials are not loaded."); }

    const { tokens } = await this.googleClient.getToken(code);
    const id_token = tokens.id_token;

    if (!id_token) { throw new Error("Failed to retrieve ID Token from Google."); }

    const ticket = await this.googleClient.verifyIdToken({
      idToken: id_token,
      audience: this.googleClientId
    });

    const payload = ticket.getPayload();

    return {
      email: payload.email,
      provider_id: payload.sub,
      first_name: payload.given_name || '',
      last_name: payload.family_name || '',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    };
  }

  async _verifyAppleIdToken(id_token) {
    const decodedToken = jwt.decode(id_token, { complete: true });
    if (!decodedToken) {
      throw new Error("Invalid Apple ID Token format.");
    }

    const kid = decodedToken.header.kid;
    const client = this.appleJwksClient;
    const key = await client.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    const payload = jwt.verify(id_token, signingKey, {
      algorithms: ['RS256'],
      audience: this.appleCreds.service_id,
      issuer: 'https://appleid.apple.com'
    });

    if (!payload.email_verified) {
      throw new Error("Apple email not verified");
    }

    return payload;
  }

  async _getAppleProfile(code) {
    if (!this.appleCreds) {
      throw new Error("Apple credentials are not loaded.");
    }

    const client_secret = this._getAppleClientSecret();
    const creds = this.appleCreds;

    const params = new URLSearchParams();
    params.append('client_id', creds.service_id);
    params.append('client_secret', client_secret);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', creds.redirect_uri);

    const tokenResponse = await axios.post(
      'https://appleid.apple.com/auth/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const id_token = tokenResponse.data.id_token;
    if (!id_token) {
      throw new Error("Failed to retrieve ID Token from Apple.");
    }

    const payload = await this._verifyAppleIdToken(id_token);
    if (!payload || !payload.sub || !payload.email) {
      throw new Error("Invalid ID Token payload from Apple.");
    }

    if (!id_token) { throw new Error("Failed to retrieve ID Token from Apple."); }

    const payload = jwt.decode(id_token);
    if (!payload || !payload.sub || !payload.email) {
      throw new Error("Invalid ID Token payload from Apple.");
    }

    const userParam = this.input.get('user');
    let first_name = 'AppleUser';
    let last_name = 'Test';
    const userParam = this.input.get('user');
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData.name) {
          first_name = userData.name.firstName || first_name;
          last_name = userData.name.lastName || last_name;
        }
      } catch (e) {
        this.warn('[Auth] Failed to parse Apple user data:', e);
      }
    }

    return {
      email: payload.email,
      provider_id: payload.sub,
      first_name: first_name,
      last_name: last_name,
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token
    };
  }


  /**
   * Mock OAuth profile for testing
   */
  async _getMockOAuthProfile(provider, code) {
    this.debug(`[Auth] Code '${code}' received from ${provider}. USING MOCK DATA.`);
    const timestamp = Date.now().toString().slice(-6);
    return {
      email: payload.email,
      provider_id: payload.sub,
      first_name: first_name,
      last_name: last_name,
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token
    };
  }

  /**
   * Callback 
   * @param {string} provider
   */
  async _handleOAuthCallback(provider) {
    try {
      const code = this.input.get(Attr.code);
      if (!code || !/^[A-Za-z0-9-_./]+$/.test(code)) {
        this.warn(`[Auth] Missing or invalid format OAuth code from ${provider}`);
        return this.output.data({ status: 'error', error: 'invalid_code' });
      }

      const state = this.input.get(Attr.state);
      if (!state) {
        this.warn(`[Auth] Missing state parameter from ${provider}`);
        throw new Error('Invalid state parameter (CSRF protection).');
      }
      if (!code) {
        this.warn(`[Auth] Missing OAuth code from ${provider}`);
        return this.output.data({
          status: 'error',
          error: 'missing_code',
          message: 'Authorization code is missing.'
        });
      }

      // SWITCH HERE: MOCK VS REAL
      const profile = provider === 'google'
        ? await this._getGoogleProfile(code)   // REAL GOOGLE
        : await this._getAppleProfile(code);    // REAL APPLE
      // const profile = await this._getMockOAuthProfile(provider, code);  // MOCK

      const { email, provider_id, first_name, last_name, access_token, refresh_token } = profile;

      const session_id = this.input.sid();
      const domain_name = this.input.host();

      const validState = await this.yp.await_query(
        'SELECT 1 FROM oauth_state WHERE state = ? AND ctime > (UNIX_TIMESTAMP() - 600)',
        state
      );
      if (!validState || validState.length === 0) {
        this.warn(`[Auth] Invalid or expired state parameter: ${state}`);
        throw new Error('Invalid or expired state parameter (CSRF protection).');
      }

      await this.yp.await_query('DELETE FROM oauth_state WHERE state = ?', state);

      const profile = provider === 'google'
        ? await this._getGoogleProfile(code)
        : await this._getAppleProfile(code);

      const { email, provider_id, first_name, last_name, access_token, refresh_token } = profile;

      const session_id = this.input.sid();
      const domain_name = this.input.host();
      this.debug(`[Auth] OAuth callback: email=${email}, provider=${provider}, provider_id=${provider_id}`);

      let sessionData = await this.yp.await_proc(
        'session_login_with_oauth',
        provider, provider_id, email, session_id, domain_name
      );
      sessionData = toArray(sessionData)[0];

      if (sessionData && sessionData.status === 'ok') {
        this.debug(`[Auth] Sign-in successful for ${email}`);
        this.debug(`[Auth] ✓ Sign-in successful for ${email}`);

        await this.yp.await_query(
          'UPDATE oauth_accounts SET access_token = ?, refresh_token = ?, mtime = UNIX_TIMESTAMP() WHERE user_id = ? AND provider = ?',
          access_token, refresh_token, sessionData.id, provider
        );
        return this.output.data(sessionData);
      }

      if (sessionData && sessionData.error_code === 'oauth_not_linked') {
        this.debug(`[Auth] Email ${email} exists but not linked to ${provider}`);
        this.debug(`[Auth] ⚠ Email ${email} exists but not linked to ${provider}`);
        return this.output.data({
          status: 'error',
          error: 'oauth_not_linked',
          message: sessionData.message,
          email: email
        });
      }

      if (sessionData && sessionData.error_code === 'oauth_user_not_found') {
        this.debug(`[Auth] User ${email} not found. Starting sign-up flow...`);

        let existingUser = await this.yp.await_proc('drumate_exists', email);
        if (existingUser && existingUser.email) {
          this.debug(`[Auth] Email ${email} already exists but OAuth not linked`);
          return this.output.data({ status: 'error', error: 'user_exists' });
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
          password: null
        };

        const creationResult = await this._create_account(createData);

        if (creationResult.error !== 0 || creationResult.status !== 'ok') {
          this.warn(`[Auth] Failed to create account for ${email}:`, creationResult);
          return this.output.data({ status: 'error', error: 'account_creation_failed' });
        }

        this.debug(`[Auth] Account created successfully for ${email}`);

        let newUser = await this.yp.await_proc('drumate_exists', email);
        if (!newUser || !newUser.id) {
          this.warn(`[Auth] Cannot find newUserId after _create_account`);
          throw new Error("Failed to get new user ID from created account.");
        }
        const newUserId = newUser.id;
        this.debug(`[Auth] Found new user ID via SP: ${newUserId}`);

        try {
          await this.yp.await_query(
            'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, ctime, mtime, access_token, refresh_token) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), ?, ?)',
            newUserId, provider, provider_id, email, access_token, refresh_token
          );
        } catch (linkError) {
          this.warn(`[Auth] CRITICAL: Failed to link OAuth account. Rolling back...`, linkError.message);
          await this.yp.await_proc('drumate_delete', newUserId);
          throw new Error(`Failed to link OAuth account: ${linkError.message}`);
        }

        this.debug(`[Auth] OAuth account linked: user_id=${newUserId}`);

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

        let newUserId = this.uid;
        if (!newUserId || newUserId === 'ffffffffffffffff') {

          let newUser = await this.yp.await_proc("drumate_exists", email);
          if (!newUser || !newUser.id) {
            this.warn(`[Auth] ✗ Cannot find newUserId (by email) after _create_account`);
            throw new Error("Failed to get new user ID from created account.");
          }
          newUserId = newUser.id;
          this.debug(`[Auth] ✓ Found new user ID via email (fallback): ${newUserId}`);
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
          provider, provider_id, email, session_id, domain_name
        );
        finalSessionData = toArray(finalSessionData)[0];

        if (finalSessionData && finalSessionData.status === 'ok') {
          this.debug(`[Auth] Sign-up complete for ${email}`);
          return this.output.data(finalSessionData);
        } else {
          this.warn(`[Auth] Failed to fetch session after sign-up:`, finalSessionData);
          return this.output.data({ status: 'error', error: 'session_fetch_failed' });
        }
      }

      this.warn(`[Auth] Unexpected error during OAuth callback:`, sessionData);
      return this.output.data({ status: 'error', error: 'unexpected_error' });

    } catch (error) {
      this.warn(`[Auth] Exception in OAuth callback:`, error);
      throw error;
    }
  }

  async google_start() {
    try {
      if (!this.googleClient) {
        return this.output.data({ status: 'error', error: 'credentials_missing' });
      }

      const state = `g_${randomUUID()}`;
      await this.yp.await_query(
        'INSERT IGNORE INTO oauth_state (state, ctime) VALUES (?, UNIX_TIMESTAMP())',
        state
      );

      const authUrl = this.googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        prompt: 'consent',
        state: state
      });

      this.debug('[Auth] Returning Google OAuth URL:', authUrl);
      this.output.data({ success: true, authUrl: authUrl });

      this.output.data({
        success: true,
        status: 'prompt',
        authUrl: authUrl
      });

    } catch (error) {
      this.warn('[Auth] Error initiating Google OAuth:', error);
      return this.output.data({ status: 'error', error: 'oauth_init_failed' });
    }
  }

  async apple_start() {
    try {
      if (!this.appleCreds) {
        return this.output.data({ status: 'error', error: 'credentials_missing' });
      }
      const creds = this.appleCreds;

      const state = `a_${randomUUID()}`;
      await this.yp.await_query(
        'INSERT IGNORE INTO oauth_state (state, ctime) VALUES (?, UNIX_TIMESTAMP())',
        state
      );

      const redirect_uri = creds.redirect_uri;
      const state = Math.random().toString(36).substring(2, 15);

      const redirect_uri = creds.redirect_uri || `${this.input.host()}${this.input.pathname().replace('apple_start', 'apple_callback')}`;

      const authUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent(creds.service_id)}` +
        `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
        `&response_type=code` +
        `&response_mode=form_post` +
        `&scope=name email` +
        `&state=${state}`;

      this.debug('[Auth] Returning Apple OAuth URL:', authUrl);
      this.output.data({ success: true, authUrl: authUrl, state: state });

      this.output.data({
        success: true,
        status: 'prompt',
        authUrl: authUrl,
        state: state
      });

    } catch (error) {
      this.warn('[Auth] Error initiating Apple OAuth:', error);
      return this.output.data({ status: 'error', error: 'oauth_init_failed' });
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