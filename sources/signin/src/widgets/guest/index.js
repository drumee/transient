/**
 * Guest landing page for an ANONYMOUS visitor, in two scopes:
 *
 *   internal  the workspace is private — its contents render as redacted
 *             placeholders behind a "Content Restricted" card.
 *             Figma 1602:76946 "Guest Landing Page (Viral) Restricted".
 *   external  the workspace is shared by link — its contents render for real,
 *             in a window with tabs, filters and a Conversation panel.
 *             Figma 1602:77081 "Guest Landing Page (Viral) Link shared".
 *
 * Scope arrives as an option (`scope`), set by the invite email's CTA via
 * signin_router; anything other than "external" is treated as internal, so a
 * missing or unknown value can never un-redact a private workspace.
 *
 * Entry points, both of which end up here:
 *   #/plugins?name=signin&kind=signin_guest   (direct, via src/seeds.js)
 *   #/welcome/signin?view=guest&scope=…       (through signin_router)
 *
 * @class signin_guest
 * @extends LetcBox
 */
require('./skin');

class signin_guest extends LetcBox {

  /**
   ** @param {object} opt
  */
  initialize(opt = {}) {
    super.initialize(opt);
    this.declareHandlers();
    this.mset({ flow: _a.y });
    // Same LOCALE bootstrap as signin_router: extend() when the host exposes it,
    // otherwise merge the visitor's language file over the global.
    try {
      LOCALE.extend(require("../../locale")('en'));
    } catch (e) {
      LOCALE = { ...LOCALE, ...require("../../locale")(Visitor.language()) }
    }
  }

  /**
   * True only for an explicitly external (shared) workspace. Fails closed: an
   * absent, empty or unrecognised scope renders the redacted internal layout, so
   * a lost query param can never expose a private workspace's contents.
   * @returns {boolean}
   */
  isExternal() {
    return String(this.mget('scope') || '').trim().toLowerCase() === 'external';
  }

  /**
   * The workspace's display name, as the window title and the header both show
   * it. Falls back to the generic scope wording when the caller passed no name,
   * so the title bar is never blank.
   * @returns {string}
   */
  workspaceName() {
    const name = (this.mget(_a.title) || this.mget(_a.name) || '').trim();
    if (name) return name;
    return this.isExternal()
      ? LOCALE.GUEST_SHARED_TITLE || 'External workspace'
      : LOCALE.GUEST_RESTRICTED_TITLE || 'Internal workspace';
  }

  /**
   * Rows the external layout renders: { folders, files, messages }.
   *
   * Supplied through options so the view stays a pure function of its data —
   * a host (or a future fetch) can pass the real share contents straight in.
   * With nothing passed it returns the sample set from the Figma frame, which is
   * what the direct #/plugins entry point shows.
   *
   * Precedence: an explicit `content` option, then whatever _loadShare() fetched
   * with the token, then the Figma sample.
   *
   * The sample is used ONLY when there is no token — i.e. the demo
   * #/plugins entry point. Once a token is present the page shows the real share
   * or nothing: presenting sample files as if they were someone's actual
   * workspace would be worse than an empty folder.
   *
   * @returns {{folders: Array, files: Array, messages: Array}}
   */
  externalContent() {
    const opt = this.mget('content');
    if (opt && (opt.folders || opt.files || opt.messages)) {
      return {
        folders: opt.folders || [],
        files: opt.files || [],
        messages: opt.messages || [],
      };
    }
    if (this._shareContent) return this._shareContent;
    if (this._shareToken()) return { folders: [], files: [], messages: [] };
    return require('./sample-content');
  }

  /**
   * The share token from the invite link, external scope only.
   * @returns {string}
   */
  _shareToken() {
    if (!this.isExternal()) return '';
    return String(this.mget('token') || '').trim();
  }

  /**
   * Resolve a service path from the host's SERVICE map, falling back to the
   * conventional dotted name. The map is assembled at runtime by the host, so a
   * plugin cannot assume a given branch is present.
   * @param {string} group
   * @param {string} name
   * @returns {string}
   */
  _svc(group, name) {
    const g = (typeof SERVICE !== 'undefined' && SERVICE && SERVICE[group]) || null;
    return (g && g[name]) || `${group}.${name}`;
  }

  /**
   * Load the real shared folder using the token the invite link carried.
   *
   * One call: dmz.list_by_token({ token, page }). The server resolves the share
   * from the token, refuses anything that is not plainly open (revoked, expired,
   * locked, password- or email-gated), scopes the listing to the shared node and
   * clamps each row's privilege to the share's capabilities.
   *
   * Nothing here widens access — the client cannot name a node, so it cannot ask
   * for anything the token does not already cover.
   *
   * Any refusal or error leaves the page on empty rows; the Figma sample is
   * never substituted for a real share.
   */
  async _loadShare() {
    const token = this._shareToken();
    if (!token) return;
    let content = { folders: [], files: [], messages: [] };
    try {
      // ONE call, authorised by the token alone (server: dmz.list_by_token).
      // Deliberately not dmz.login + media.show_node_by: dmz.login refuses to
      // bind a share identity onto a main-domain session (its regsid guard,
      // which exists so a share can never hijack or clamp someone's auth
      // session), so from this page that pair can only ever 403. The listing
      // endpoint answers from the token and never touches the caller's session.
      const res = await this.postService(this._svc('dmz', 'list_by_token'), {
        token,
        page: 1,
      });
      if (!res || res.error || res.error_code || res.status !== 'TICKET_OK') {
        // Gated, revoked, expired or unknown — the server tells us which, and
        // deliberately sends no items. Show the empty state, never the sample.
        this.warn('[signin_guest] share not listable:', (res && (res.status || res.error)) || 'no response');
      } else {
        if (res.title) this.mset({ title: res.title });
        // Kept for the join hand-off: the guest URL carries a token and a name
        // but no hub_id, and the invited workspace cannot be opened after login
        // without one. This reply is the only place the page learns it.
        this._shareHubId = res.hub_id || '';
        const { mapListing } = require('./share-content');
        content = { ...mapListing(res.items), messages: [] };
      }
    } catch (e) {
      this.warn('[signin_guest] share load failed', e && (e.reason || e.message));
    }
    this._shareContent = content;
    // Re-render with what came back (or with empty rows on failure).
    this.feed(require('./skeleton').default(this));
    if (content.files && content.files.length) this._loadPosters(token);
    this._loadChat(token);
  }

  /**
   * The workspace conversation, from dmz.chat_by_token.
   *
   * Separate from the listing for the same reason the posters are: the file
   * grid is what the page is for, and it should not wait on a second query to
   * appear. The panel fills in when this lands.
   *
   * The server scopes the messages to the shared node and sends display names
   * only — never an author's email — so nothing here has to redact.
   *
   * Silent on failure: an empty conversation panel is a reasonable page, and a
   * share whose chat cannot be read still lists its files.
   *
   * @param {string} token
   */
  async _loadChat(token) {
    try {
      const res = await this.postService(this._svc('dmz', 'chat_by_token'), {
        token,
        page: 1,
      });
      if (!res || res.status !== 'TICKET_OK' || !res.messages) return;
      const { mapMessages } = require('./chat-content');
      const messages = mapMessages(res.messages);
      if (!messages.length) return;
      this._shareContent = { ...this._shareContent, messages };
      this.feed(require('./skeleton').default(this));
    } catch (e) {
      this.warn('[signin_guest] chat unavailable', e && (e.reason || e.message));
    }
  }

  /**
   * Second pass: fetch the file previews and upgrade the tiles in place.
   *
   * Split from the listing on purpose. The previews come back inlined as data
   * URIs rather than as URLs, because the URL the desk grid uses
   * (file/<format>/<nid>/<hub_id>, i.e. media.<format>) authorises against the
   * caller's own session — the grant this page can never hold — so serving them
   * any other way would mean opening a second anonymous route. Inlining keeps
   * everything behind the one token-gated call.
   *
   * The cost of that choice is size: one video poster outweighs the entire
   * metadata listing, and asking for both at once measured ~330KB / +1.3s on
   * stage, which the grid would spend staring at an empty panel. So the listing
   * paints first with filetype icons, and each poster replaces its icon as this
   * arrives. A failure here is silent — the icons are already a valid render.
   *
   * @param {string} token
   */
  async _loadPosters(token) {
    try {
      const res = await this.postService(this._svc('dmz', 'list_by_token'), {
        token,
        page: 1,
        with_posters: 1,
      });
      if (!res || res.status !== 'TICKET_OK' || !res.items) return;
      const posters = {};
      for (const row of res.items) {
        if (row && row.nid && row.poster) posters[row.nid] = row.poster;
      }
      if (!Object.keys(posters).length) return;
      const files = this._shareContent.files.map((f) =>
        posters[f.nid] ? { ...f, poster: posters[f.nid] } : f
      );
      this._shareContent = { ...this._shareContent, files };
      this.feed(require('./skeleton').default(this));
    } catch (e) {
      // Icons stay; nothing to recover.
      this.warn('[signin_guest] posters unavailable', e && (e.reason || e.message));
    }
  }

  /**
   *
  */
  onDomRefresh() {
    // One attribute the whole skin switches on — red/lock for internal, pink/link
    // for external — so neither skeleton has to know about the other's styling.
    if (this.el) {
      this.el.dataset.scope = this.isExternal() ? 'external' : 'internal';
    }
    this.feed(require('./skeleton').default(this));
    // Render first, then fill in: the chrome is useful immediately and the
    // listing re-feeds when it arrives. No token (internal, or the demo entry
    // point) → this returns straight away and the page never makes a request.
    this._loadShare();
  }

  /**
   * Both CTAs leave the plugin for the normal welcome flow. A full page reload is
   * intentional — it is what the rest of the welcome flow does, and it guarantees
   * the sign-in/sign-up plugin boots against a clean hash.
   * @param {string} hash
   */
  _leaveTo(hash) {
    if (location.hash === hash) return location.reload();
    location.hash = hash;
    location.reload();
  }

  /**
   * Remember which workspace this guest was invited to, so the desk can offer
   * to open it once they have signed in.
   *
   * Written just before leaving for the sign-in form and read exactly once, by
   * the desk, after Home is ready. sessionStorage rather than localStorage: the
   * intent belongs to this visit, and a tab closed at the sign-in form should
   * not surface a workspace prompt days later. It survives the hash change and
   * full reload this flow makes, which a plain in-memory field would not.
   *
   * The workspace comes off the link (`hub`), which the invite email sets for
   * internal and external alike. An older link without it still works when it is
   * external, because the listing reply carries hub_id; an older INTERNAL link
   * has neither and arms nothing.
   *
   * No hub, no key, no dialog — which is also what keeps the dialog away from an
   * ordinary sign-in.
   */
  _armJoinIntent() {
    // The link carries the workspace id on both scopes; the external listing
    // reply is a fallback for links minted before it did.
    const hub_id = (this.mget(_a.hub_id) || '').trim() || this._shareHubId;
    if (!hub_id) return;
    try {
      // localStorage, not session: signing up sends the user to their mail
      // client and back through a NEW TAB on the verify link, which a
      // session-scoped key does not survive. This mirrors the signup router's
      // own captureRef (drumee_ref), which persists across the same flow for
      // the same reason. `ts` lets the desk ignore an intent that has gone
      // stale — see _maybeOfferInvitedWorkspace.
      localStorage.setItem('drumee_guest_join', JSON.stringify({
        hub_id,
        name: (this.mget(_a.title) || this.mget(_a.name) || '').trim(),
        ts: Date.now(),
      }));
    } catch (e) {
      // Storage unavailable (private mode, blocked) — the guest still reaches
      // the form, they simply do not get the prompt afterwards.
      this.warn('[signin_guest] could not arm join intent', e && e.message);
    }
  }

  /**
   * @param {*} cmd
   * @param {*} args
  */
  onUiEvent(cmd, args = {}) {
    const service = args.service || cmd.get(_a.service);
    switch (service) {
      // Both exits arm the intent. Sign-in is the documented route (the form
      // links on to signup), but the banner goes straight to signup, and a
      // guest who takes that route was invited just the same.
      case 'go-login':
        this._armJoinIntent();
        return this._leaveTo('#/welcome/signin');

      case 'open-signup':
        this._armJoinIntent();
        return this._leaveTo('#/welcome/signup');
    }
  }
}

module.exports = signin_guest
