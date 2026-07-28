/**
 * Language for server-rendered pages — product default: ENGLISH.
 *
 * Only the signed-in user's stored profile choice selects another language.
 * The browser's Accept-Language is deliberately NOT auto-adopted here: doing
 * so rendered <html lang="fr"> (and the inline bootstrap lang the client's
 * Visitor.pagelang() trusts) for any visitor whose OS/browser lists French,
 * flipping whole sessions to French for users who never chose it. An
 * explicit ?lang= deep-link is honored client-side by pagelang(), which
 * reads the URL ahead of everything else, so the page render doesn't need
 * to look at request params — the ones it would see (x-param-lang) are
 * echoes of the client's own possibly-poisoned state anyway.
 */
const SUPPORTED = /^(en|fr|es|km|ru|zh)$/;

module.exports = function pageLanguage(svc) {
  let lang = null;
  try {
    const profile = svc.user && svc.user.get("profile");
    if (profile) lang = profile.lang;
  } catch (e) {
    lang = null;
  }
  lang = String(lang || "en").toLowerCase().split(/[-_.]/)[0];
  if (!SUPPORTED.test(lang)) lang = "en";
  return lang;
};
