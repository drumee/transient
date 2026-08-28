const { button } = require("../../toolkit/skeleton");

/**
 * Check-inbox view shown after the forgot-password form is submitted.
 * Tells the user a reset link was emailed, with a resend button (on a
 * countdown cooldown — see ../index.js, which re-sends the reset-password
 * email template via otp.send_link) and a "Log in now" link back to sign in.
 */
function __skl_check_inbox(ui) {
  const fam = ui.fig.family;
  const email = ui.mget(_a.email) || "";

  const card = Skeletons.Box.Y({
    className: `${fam}__main ${fam}__check-inbox`,
    debug: __filename,
    kids: [
      // Envelope icon in a soft primary circle
      Skeletons.Box.X({
        className: `${fam}__inbox-icon`,
        kids: [
          Skeletons.Button.Svg({ ico: "app-mail", className: `${fam}__envelope` }),
        ],
      }),
      // Heading: title + (we sent / email)
      Skeletons.Box.Y({
        className: `${fam}__inbox-heading`,
        kids: [
          Skeletons.Element({
            className: `${fam}__inbox-title`,
            content: LOCALE.CHECK_YOUR_INBOX || "Check your inbox",
          }),
          Skeletons.Box.Y({
            className: `${fam}__inbox-subtext`,
            kids: [
              Skeletons.Element({
                className: `${fam}__inbox-sent`,
                content: LOCALE.WE_SENT_LINK_TO || "We've sent a password reset link to",
              }),
              Skeletons.Element({ className: `${fam}__inbox-email`, content: email }),
            ],
          }),
        ],
      }),
      // Actions: resend button + "Remember password? Log in now →"
      Skeletons.Box.Y({
        className: `${fam}__inbox-actions`,
        kids: [
          button(ui, {
            label: LOCALE.RESEND_EMAIL || "Resend email",
            service: "resend-email",
            ico: "refresh-view",
            type: _a.api,
            sys_pn: "resend-button",
            priority: "primary",
          }),
          Skeletons.Box.X({
            className: `${fam}__links`,
            kids: [
              Skeletons.Element({
                className: `${fam}__text`,
                content: LOCALE.REMEMBER_PASSWORD || "Remember password?",
              }),
              Skeletons.Note({
                className: `${fam}__text link`,
                content: LOCALE.LOG_IN_NOW || "Log in now →",
                service: "back-to-signin",
                uiHandler: [ui],
              }),
            ],
          }),
        ],
      }),
      // Footer note
      Skeletons.Box.Y({
        className: `${fam}__inbox-footer`,
        kids: [
          Skeletons.Element({
            className: `${fam}__inbox-note`,
            content: LOCALE.LINK_EXPIRES_NOTE || "Link expires in 1 hour.",
          }),
          Skeletons.Element({
            className: `${fam}__inbox-note`,
            content: LOCALE.CHECK_SPAM_NOTE || "Check your spam folder if you don't see it.",
          }),
        ],
      }),
    ],
  });

  return Skeletons.Box.Y({
    className: `${fam}__wrapper`,
    kids: [card],
  });
}

export default __skl_check_inbox;
