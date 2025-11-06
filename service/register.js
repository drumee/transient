// service/register.js

const { Entity } = require('@drumee/server-core');
const { toArray, Attr, Cache, sysEnv } = require('@drumee/server-essentials'); 
const { resolve } = require('path');
const { readFileSync: readJson } = require("jsonfile");
const { readFileSync } = require("fs"); 

const { OAuth2Client } = require('google-auth-library'); 
const jwt = require('jsonwebtoken'); 
const axios = require('axios');

const __butler = require('./butler.js');

class Register extends __butler {

  initialize(opt) {
    super.initialize(opt);
    
    // 
    try {
      // // 1. Google Credentials
      // this.googleCreds = Cache.getSysConf('google_oauth_creds'); 
      
      // if (this.googleCreds && this.googleCreds.client_id) {
      //   this.googleClient = new OAuth2Client(
      //     this.googleCreds.client_id,
      //     this.googleCreds.client_secret,
      //     this.googleCreds.redirect_uri
      //   );
      //   this.googleClientId = this.googleCreds.client_id;
      //   console.log("[Auth] Google Credentials loaded.");
      // } else {
      //   this.warn("[Auth] CRITICAL: Failed to load 'google_oauth_creds'.");
      // }

      // // Apple Credentials
      // this.appleCreds = Cache.getSysConf('apple_oauth_creds');
      // if (this.appleCreds && this.appleCreds.team_id) {
      //   console.log("[Auth] Apple Credentials loaded.");
      // } else {
      //   this.warn("[Auth] CRITICAL: Failed to load 'apple_oauth_creds'.");
      // }

    } catch (e) {
      this.warn("[Auth] CRITICAL: Failed to load OAuth credentials!", e.message);
    }
  }
  
  async _getMockOAuthProfile(provider, code) {
    console.log(`[Auth] Code received '${code}' from ${provider}. USING MOCK DATA.`);
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
   * callback for Google and Apple.
   * @param {string} provider - 'google' or 'apple'
   */
  async _handleOAuthCallback(provider) {
    const code = this.input.get(Attr.code); 
    if (!code) {
      this.warn("[Auth] OAuth code is missing.");
      throw new Error("OAuth authorization code is missing.");
    }

    // --- 1. GET USER INFO (USE MOCK) ---
    // (Will change _getMockOAuthProfile to _getGoogleProfile / _getAppleProfile)
    const profile = await this._getMockOAuthProfile(provider, code); 
    const { email, provider_id, first_name, last_name, access_token, refresh_token } = profile;
    
    const session_id = this.input.sid();
    const domain_name = this.input.host(); 

    console.log(`[Auth] OAuth info received (Mocked): email=${email}, provider_id=${provider_id}`);

    // --- 2. SIGN IN / LINK ---
    let sessionData = await this.yp.await_proc( 
      'session_login_with_oauth',
      provider,
      provider_id,
      email,
      session_id,
      domain_name
    );
    sessionData = toArray(sessionData)[0];

    // --- 3. RESULTS PROCESSING ---
    // ----- CASE A: SUCCESS SIGN IN -----
    if (sessionData && sessionData.status === 'ok') {
      console.log(`[Auth] Success to Signin/Link user ${email}.`);
      
      await this.yp.await_query(
        'UPDATE oauth_accounts SET access_token = ?, refresh_token = ?, mtime = UNIX_TIMESTAMP() WHERE user_id = ? AND provider = ?',
        access_token, refresh_token, sessionData.id, provider
      );

      this.output.data(sessionData);
      return;
    }
    
    // ----- CASE B: NEW SIGN UP -----
    console.log(`[Auth] User ${email} doesn't exist. Sign up new account...`);
    
    const createData = {
      email: email,
      firstname: `${first_name} ${last_name}`, 
      password: null 
    };
    
    const creationResult = await this._create_account(createData);
    
    if (creationResult.error !== 0 || creationResult.status !== 'ok') {
      this.warn("[Auth] _create_account failed", creationResult);
      throw new Error(`Failed to create account: ${creationResult.status || 'unknown_error'}`);
    }
    
    console.log(`[Auth] Success Sign up for ${email}.`);

    const newUserId = this.uid; 
    if (!newUserId) {
      this.warn("[Auth] Can not find newUserId (this.uid) in session after _create_account");
      throw new Error("Failed to get new user ID from session after creation.");
    }
    
    await this.yp.await_query(
      'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, ctime, mtime, access_token, refresh_token) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), ?, ?)',
      newUserId, 
      provider, 
      provider_id, 
      email,
      access_token,
      refresh_token
    );
    
    console.log(`[Auth] Already linked ${provider} ID with user ${newUserId}.`);    
    
    console.log(`[Auth] Re-calling session_login_with_oauth to fetch full session packet.`);
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
      this.output.data(finalSessionData);
    } else {
      this.warn("[Auth] Failed to fetch session packet after creating user.", finalSessionData);
      throw new Error("Failed to log in automatically after creating account.");
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