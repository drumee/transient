// service/register.js

const { Entity } = require('@drumee/server-core');
const { toArray, Attr, sysEnv } = require('@drumee/server-essentials');
const { resolve } = require('path');
const { readFileSync: readJson } = require("jsonfile");

// Import class __butler
const __butler = require('./butler.js');

/**
 * Register class
 */
class Register extends __butler {

  initialize(opt) {
    super.initialize(opt);
    console.log("Register Service Initialized.");
  }

  /**
   * Get the OAuth mock data to test
   * Will change to call the real API of Google/Apple
   * @param {string} provider - 'google' or 'apple'
   * @param {string} code - provider code
   */
  async _getMockOAuthProfile(provider, code) {
    console.log(`[Auth] Code received '${code}' from ${provider}. Skip the real API (no credentials yet).`);

    const timestamp = Date.now().toString().slice(-6);

    return {
      email: `user.${timestamp}@${provider}-mock.com`,
      provider_id: `${provider}-id-${timestamp}`, // 'sub' (Subject ID)
      first_name: provider === 'google' ? 'GoogleUser' : 'AppleUser',
      last_name: 'Test'
    };

    /*
    // Further:
    // const { CLIENT_ID, CLIENT_SECRET } = getCredentialsFor(provider);
    // const { id_token, access_token, refresh_token } = await OAuth.exchangeCodeForToken(code, CLIENT_ID, CLIENT_SECRET);
    // const { email, sub, given_name, family_name } = await OAuth.verifyToken(id_token, CLIENT_ID);
    // return { email, provider_id: sub, first_name: given_name, last_name: family_name, access_token, refresh_token };
    */


    const { credential_dir } = sysEnv();
    /**
     * Google 
     * let gkey = resolve(credential_dir, `google/info.json`);
     * const {id,secret} = readJson(gkey)
     */

    /**
     * Apple
     * let akey = resolve(credential_dir, `apple/info.json`);
     * const {team_id,service_id,key_id} = readJson(akey);
     * let pkey = resolve(credential_dir, `apple`, key_id, '.p8');
     * const private_key_file = readFileSync(pkey)
     */


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

    // --- 1. GET USER INFORMATION FROM PROVIDER ---
    // (This is mock data)
    const profile = await this._getMockOAuthProfile(provider, code);
    const { email, provider_id, first_name, last_name } = profile;

    const session_id = this.input.sid();
    const domain_name = this.input.host();

    console.log(`[Auth] OAuth information received (Mocked): email=${email}, provider_id=${provider_id}`);

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

    // --- 3. PROCESS THE RESULTS ---

    // ----- CASE A: SUCCESS SIGN IN -----
    if (sessionData && sessionData.status === 'ok') {
      console.log(`[Auth] Success to Signin/Link user ${email}.`);
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
      this.warn("[Auth] _create_account thất bại", creationResult);
      throw new Error(`Failed to create account: ${creationResult.status || 'unknown_error'}`);
    }

    console.log(`[Auth] Succes Sign up for ${email}.`);

    const newUserId = this.session.uid();
    if (!newUserId) {
      this.warn("[Auth] Can not find newUserId in session after _create_account");
      throw new Error("Failed to get new user ID from session after creation.");
    }

    await this.yp.await_query(
      'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, ctime, mtime) VALUES (?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())',
      newUserId,
      provider,
      provider_id,
      email
    );

    console.log(`[Auth] Already linked ${provider} ID with user ${newUserId}.`);


    this.output.data({
      success: true,
      status: "created_and_linked",
      message: "Account created and linked successfully."
    });
  }

  /**
   * callback processing from Google
   */
  async google_callback() {
    return this._handleOAuthCallback('google');
  }

  /**
   * callback processing from Apple
   */
  async apple_callback() {
    return this._handleOAuthCallback('apple');
  }
}

module.exports = Register;