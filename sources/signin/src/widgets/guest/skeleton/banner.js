/**
 * Sticky bottom conversion banner (Figma 1602:77020): purple gradient bar with the
 * lightning tile + headline on the left, social-proof subline + "Sign Up Free" on
 * the right. The bar's CTA fires `open-signup`; the nav's Join Workspace goes
 * to the sign-in form instead (`go-login`).
 * @param {LetcBox} ui
 */
function __skl_signin_guest_banner(ui) {
  const fig = ui.fig.family;

  const left = Skeletons.Box.X({
    className: `${fig}__banner-left`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__banner-tile`,
        kids: [
          Skeletons.Button.Svg({
            ico: "app-lightning",
            className: `${fig}__banner-tile-ico`,
          }),
        ],
      }),
      Skeletons.Note({
        className: `${fig}__banner-headline`,
        content: LOCALE.GUEST_BANNER_HEADLINE ||
          "Shared via Drumee — Get your own workspace →",
      }),
    ],
  });

  const right = Skeletons.Box.X({
    className: `${fig}__banner-right`,
    kids: [
      Skeletons.Note({
        className: `${fig}__banner-subline`,
        content: LOCALE.GUEST_BANNER_SUBLINE ||
          "Join 2,000+ creators curating their best work.",
      }),
      Skeletons.Note({
        className: `${fig}__banner-cta`,
        content: LOCALE.SIGNUP_FOR_FREE_CTA || "Sign Up Free",
        service: 'open-signup',
        uiHandler: [ui],
        kidsOpt: { active: 0 },
      }),
    ],
  });

  return Skeletons.Box.X({
    className: `${fig}__banner`,
    debug: __filename,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__banner-bar`,
        kids: [left, right],
      }),
    ],
  });
}

module.exports = __skl_signin_guest_banner;
