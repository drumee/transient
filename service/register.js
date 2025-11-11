// service/register.js

const { toArray, Attr, sysEnv } = require('@drumee/server-essentials');
const { resolve } = require('path');
const { readFileSync: readJson } = require('jsonfile');
const { readFileSync } = require('fs');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');
const { randomUUID } = require('crypto');
const Butler = require('./butler.js');

class Register extends Butler {
  initialize(opt) {
    super.initialize(opt);

    this.appleJwksClient = jwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: 'https://appleid.apple.com/auth/keys'
    });

    // Cache for Apple client secret
    this.appleClientSecret = null;
    this.appleClientSecretExp = 0;

    try {
      const { credential_dir, svc_location } = sysEnv();

      // Google credentials with dynamic callback URI
      const gkey = resolve(credential_dir, `google/info.json`);
      const gCreds = readJson(gkey);
      
      if (gCreds && gCreds.id && gCreds.secret) {
        // Dynamic callback: works for all developer endpoints
        const googleCallback = `https://${this.input.host()}${svc_location}/register.google_callback?`;
        gCreds.redirect_uri = googleCallback;
        
        this.googleCreds = gCreds;
        this.googleClient = new OAuth2Client(
          gCreds.id, gCreds.secret, gCreds.redirect_uri
        );
        this.googleClientId = gCreds.id;
        this.debug("[Auth] Google Credentials loaded. Callback:", googleCallback);
      } else {
        this.warn("[Auth] CRITICAL: Failed to load 'google/info.json'.");
      }

      // Apple credentials with dynamic callback URI
      const akey = resolve(credential_dir, `apple/info.json`);
      const aCreds = readJson(akey);
      const pkey = resolve(credential_dir, `apple`, `${aCreds.key_file}`);
      const private_key = readFileSync(pkey, 'utf8');
      if (aCreds && aCreds.team_id && aCreds.service_id && aCreds.key_id && private_key) {
        const appleCallback = `https://${this.input.host()}${svc_location}/register.apple_callback`;
        aCreds.redirect_uri = appleCallback;
        
        this.appleCreds = {
          team_id: aCreds.team_id,
          service_id: aCreds.service_id,
          key_id: aCreds.key_id,
          private_key,
          redirect_uri: aCreds.redirect_uri
        };
        this.debug("[Auth] Apple Credentials loaded. Callback:", appleCallback);
      } else {
        this.warn("[Auth] CRITICAL: Failed to load Apple credentials.");
      }
    } catch (e) {
      this.warn("[Auth] CRITICAL: Failed to load OAuth credentials!", e.message);
    }
  }

  /**
   * Get cached Apple client secret (or generate new one)
   */
  _getAppleClientSecret() {
    const now = Math.floor(Date.now() / 1000);
    if (this.appleClientSecret && now < this.appleClientSecretExp) {
      return this.appleClientSecret;
    }

    this.debug("[Auth] Generating new Apple Client Secret...");
    const creds = this.appleCreds;
    if (!creds || !creds.private_key) {
      throw new Error("Apple credentials or private key not loaded.");
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
      algorithm: 'ES256',
      keyid: creds.key_id
    });
    this.appleClientSecretExp = exp;

    return this.appleClientSecret;
  }

  /**
   * Get Google user profile
   */
  async _getGoogleProfile(code) {
    if (!this.googleClient) {
      throw new Error("Google credentials are not loaded.");
    }

    const { tokens } = await this.googleClient.getToken(code);
    const id_token = tokens.id_token;
    if (!id_token) {
      throw new Error("Failed to retrieve ID Token from Google.");
    }

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

  /**
   * Verify Apple ID Token with JWKS
   */
  async _verifyAppleIdToken(id_token) {
    const decodedToken = jwt.decode(id_token, { complete: true });
    if (!decodedToken) {
      throw new Error("Invalid Apple ID Token format.");
    }

    const kid = decodedToken.header.kid;
    const key = await this.appleJwksClient.getSigningKey(kid);
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

  /**
   * Get Apple user profile
   */
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

    // Apple sends name only on first sign-in via 'user' parameter
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
   * Handle OAuth callback for both Google and Apple
   */
  async _handleOAuthCallback(provider) {
    try {
      const code = this.input.get(Attr.code);
      if (!code || !/^[A-Za-z0-9-_./]+$/.test(code)) {
        this.warn(`[Auth] Missing or invalid OAuth code from ${provider}`, Attr.code, code);
        return this.output.data({ status: 'error', error: 'invalid_code' });
      }

      const state = this.input.get(Attr.state);
      if (!state) {
        this.warn(`[Auth] Missing state parameter from ${provider}`);
        return this.output.data({ status: 'error', error: 'missing_state' });
      }

      const validState = await this.yp.await_query(
        'SELECT 1 FROM oauth_state WHERE state = ? AND ctime > UNIX_TIMESTAMP() - 600',
        state
      );
      if (!validState || validState.length === 0) {
        this.warn(`[Auth] Invalid or expired state: ${state}`);
        return this.output.data({ status: 'error', error: 'invalid_state' });
      }

      // Delete used state
      await this.yp.await_query('DELETE FROM oauth_state WHERE state = ?', state);

      // Get user profile from OAuth provider
      const profile = provider === 'google'
        ? await this._getGoogleProfile(code)
        : await this._getAppleProfile(code);

      const { email, provider_id, first_name, last_name, access_token, refresh_token } = profile;

      const session_id = this.input.sid();
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
        return this.output.data(sessionData);
      }

      // CASE B: Email exists but not linked
      if (sessionData && sessionData.error_code === 'oauth_not_linked') {
        this.debug(`[Auth] Email ${email} exists but not linked to ${provider}`);
        return this.output.data({
          status: 'error',
          error: 'oauth_not_linked',
          message: sessionData.message,
          email: email
        });
      }

      // CASE C: New user - sign up
      if (sessionData && sessionData.error_code === 'oauth_user_not_found') {
        this.debug(`[Auth] User ${email} not found. Starting sign-up...`);

        // Double-check email doesn't exist
        let existingUser = await this.yp.await_proc('drumate_exists', email);
        if (existingUser && existingUser.email) {
          this.debug(`[Auth] Email ${email} exists but OAuth not linked`);
          return this.output.data({ status: 'error', error: 'user_exists' });
        }

        // Create new account
        const fullname = `${first_name} ${last_name}`.trim();
        const createData = {
          email: email,
          firstname: fullname || first_name,
          password: null // OAuth users don't have password
        };

        const creationResult = await this._create_account(createData);
        if (creationResult.error !== 0 || creationResult.status !== 'ok') {
          this.warn(`[Auth] Failed to create account for ${email}:`, creationResult);
          return this.output.data({ status: 'error', error: 'account_creation_failed' });
        }

        this.debug(`[Auth] Account created for ${email}`);

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

        this.debug(`[Auth] OAuth account linked for user ${newUserId}`);

        // Get full session data
        let finalSessionData = await this.yp.await_proc(
          'session_login_with_oauth',
          provider, provider_id, email, session_id, domain_name
        );
        finalSessionData = toArray(finalSessionData)[0];

        if (finalSessionData && finalSessionData.status === 'ok') {
          this.debug(`[Auth] Sign-up complete for ${email}`);
          return this.output.data(finalSessionData);
        } else {
          this.warn(`[Auth] Failed to get session after sign-up:`, finalSessionData);
          return this.output.data({ status: 'error', error: 'session_fetch_failed' });
        }
      }

      this.warn(`[Auth] Unexpected OAuth callback result:`, sessionData);
      return this.output.data({ status: 'error', error: 'unexpected_error' });

    } catch (error) {
      this.warn(`[Auth] OAuth callback exception:`, error);
      throw error;
    }
  }

  /**
   * Start Google OAuth flow
   */
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

      this.debug('[Auth] Google OAuth URL generated with state:', state);
      this.output.data({ success: true, authUrl: authUrl, status: 'prompt' });
    } catch (error) {
      this.warn('[Auth] Error initiating Google OAuth:', error);
      return this.output.data({ status: 'error', error: 'oauth_init_failed' });
    }
  }

  /**
   * Start Apple OAuth flow
   */
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
      const authUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent(creds.service_id)}` +
        `&redirect_uri=${encodeURIComponent(creds.redirect_uri)}` +
        `&response_type=code` +
        `&response_mode=form_post` +
        `&scope=${encodeURIComponent("name email")}` +
        `&state=${state}`;

      this.output.data({ success: true, authUrl, state: state, status: 'prompt' });
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