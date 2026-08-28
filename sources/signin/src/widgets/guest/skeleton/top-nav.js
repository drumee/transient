// Public marketing site. The nav links leave the Drumee instance the guest landed
// on — same target as ui-team's dmz/sharebox top-nav.
const DRUMEE_SITE = "https://drumee.com/";

/**
 * Top app bar: logo | Product · Features · Pricing | Login + Join Workspace.
 * @param {LetcBox} ui
 */
function __skl_signin_guest_top_nav(ui) {
  const fig = ui.fig.family;

  // Sprite mark + wordmark, the same pairing the toolkit's header() helper uses,
  // rather than a flattened logo image.
  const logo = Skeletons.Box.X({
    className: `${fig}__nav-logo`,
    kids: [
      Skeletons.Button.Svg({
        ico: "logo-upload",
        className: `${fig}__nav-logo-ico`,
      }),
      Skeletons.Element({
        className: `${fig}__nav-logo-text`,
        content: "drumee",
      }),
    ],
  });

  // Marketing links are real anchors (href => the builder renders an <a>), so they
  // open in a new tab without going through onUiEvent.
  const navLink = (label) =>
    Skeletons.Box.X({
      className: `${fig}__nav-link`,
      href: DRUMEE_SITE,
      attrOpt: { target: "_blank", rel: "noopener noreferrer" },
      kids: [
        Skeletons.Note({
          className: `${fig}__nav-link-label`,
          content: label,
        }),
      ],
    });

  const links = Skeletons.Box.X({
    className: `${fig}__nav-links`,
    kids: [
      navLink(LOCALE.PRODUCT || "Product"),
      navLink(LOCALE.FEATURES || "Features"),
      navLink(LOCALE.PRICING || "Pricing"),
    ],
  });

  const actions = Skeletons.Box.X({
    className: `${fig}__nav-actions`,
    kids: [
      // Join Workspace goes to the SIGN-IN form, not sign-up: someone who was
      // invited to a workspace already has, or is about to be given, an account
      // there, and the form links on to sign-up for anyone who does not.
      // The banner's "Sign Up Free" is the sign-up route and keeps open-signup.
      Skeletons.Note({
        className: `${fig}__nav-join`,
        content: LOCALE.JOIN_WORKSPACE || "Join Workspace",
        service: 'go-login',
        uiHandler: [ui],
        kidsOpt: { active: 0 },
      }),
    ],
  });

  return Skeletons.Box.X({
    className: `${fig}__nav`,
    debug: __filename,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__nav-inner`,
        kids: [logo, links, actions],
      }),
    ],
  });
}

module.exports = __skl_signin_guest_top_nav;
