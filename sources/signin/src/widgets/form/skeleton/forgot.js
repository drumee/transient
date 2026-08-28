const { entry, button } = require("../../toolkit/skeleton");

/**
 * Forgot-password view: a centered logo, title, single email input and a
 * submit button. Submitting fires the `forgot-submit` service (see
 * ../index.js), which validates the email and sends a reset link/code.
 */
function __skl_welcome_forgot(ui) {
  const fig = ui.fig.family;
  let haptic = 10000;

  let message = Skeletons.Box.X({
    className: `${fig}__error-container`,
    kids: [
      Skeletons.Note({
        className: `${fig}__error-content`,
        content: "",
        sys_pn: _a.message,
      }),
    ],
  });

  // Centered drumee logo + title (no progress bar / no subtitle, per design).
  const head = Skeletons.Box.Y({
    className: `${fig}__forgot-head`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__forgot-logo`,
        kids: [
          Skeletons.Button.Svg({
            ico: "logo-upload",
            className: `${fig}__forgot-logo-icon`,
          }),
        ],
      }),
      Skeletons.Element({
        className: `${fig}__forgot-title`,
        content: LOCALE.RESET_PASSWORD_TITLE || "Forgot your password?",
      }),
    ],
  });

  // Labelled email input with the app-mail icon (matches the sign-in form).
  // The (initially empty) error message sits tight beneath it so it doesn't
  // add an extra gap slot.
  const field = Skeletons.Box.Y({
    className: `${fig}__forgot-field`,
    kids: [
      entry(ui, {
        label: LOCALE.EMAIL || "EMAIL",
        placeholder: LOCALE.ENTER_YOUR_EMAIL || "Enter your email",
        name: _a.username,
        sys_pn: _a.username,
        service: "forgot-input",
        ico: "app-mail",
        value: ui.mget(_a.username) || "",
      }),
      message,
    ],
  });

  // Submit button + "Remember password? Log in now →" footer.
  const actions = Skeletons.Box.Y({
    className: `${fig}__forgot-actions`,
    kids: [
      button(ui, {
        label: LOCALE.SEND_RESET_LINK || "Send me the link",
        service: "forgot-submit",
        type: _a.email,
        sys_pn: "forgot-button",
        haptic,
      }),
      Skeletons.Box.X({
        className: `${fig}__links`,
        kids: [
          Skeletons.Element({
            className: `${fig}__text`,
            content: LOCALE.REMEMBER_PASSWORD || "Remember password?",
          }),
          Skeletons.Note({
            className: `${fig}__text link`,
            content: LOCALE.LOG_IN_NOW || "Log in now →",
            service: "back-to-signin",
            uiHandler: [ui],
          }),
        ],
      }),
    ],
  });

  let card = Skeletons.Box.Y({
    className: `${fig}__main ${fig}__forgot`,
    debug: __filename,
    kids: [head, field, actions],
  });

  let a = Skeletons.Box.Y({
    className: `${fig}__wrapper`,
    kids: [card],
  });

  return a;
}

export default __skl_welcome_forgot;
