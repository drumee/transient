const {
  entry,
  header,
  button,
  password,
  termsAndConditions,
} = require("../../toolkit/skeleton");

function __skl_welcome_signup(ui) {
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
  // Inline "email not verified" banner + CTA. Rendered only after a login attempt
  // on an unverified account (checkLoginStatus sets ui._unverifiedEmail on the
  // EMAIL_NOT_VERIFIED status). The CTA fires `go-verify` → Check-your-inbox.
  const verifyBanner = ui._unverifiedEmail
    ? Skeletons.Box.X({
        className: `${fig}__verify-row`,
        kids: [
          Skeletons.Note({
            className: `${fig}__text`,
            content: `${LOCALE.EMAIL_NOT_VERIFIED_TITLE || "Email not verified"}.`,
          }),
          Skeletons.Note({
            className: `${fig}__text link`,
            content: `${LOCALE.VERIFY_EMAIL || "Verify email"} →`,
            service: "go-verify",
            uiHandler: [ui],
          }),
        ],
      })
    : null;
  const form = Skeletons.Box.Y({
    className: `${fig}__form`,
    kids: [
      entry(ui, {
        label: LOCALE.EMAIL || "EMAIL",
        placeholder: LOCALE.ENTER_YOUR_EMAIL || "Enter your email",
        name: _a.username,
        sys_pn: _a.username,
        service: _a.input,
        ico: "app-mail",
        value: ui.mget(_a.username) || "",
      }),
      password(ui, {
        label: LOCALE.PASSWORD_LABEL || "PASSWORD",
        placeholder: LOCALE.ENTER_YOUR_PASSWORD || "Enter your password",
        name: _a.password,
        sys_pn: _a.password,
        service: _a.input,
        ico: "",
      }),
      Skeletons.Box.X({
        className: `${fig}__forgot-row`,
        kids: [
          Skeletons.Note({
            className: `${fig}__forgot-link`,
            content: LOCALE.FORGOT_PASSWORD || "Forgot Password →",
            service: "reset-password",
            uiHandler: [ui],
          }),
        ],
      }),
      message,
      verifyBanner,
      button(ui, {
        label: LOCALE.LOG_IN_TO_WORKSPACE || "Log In to Workspace",
        service: "signin",
        type: _a.email,
        sys_pn: "commit-button",
        haptic,
      }),
    ].filter(Boolean),
  });

  const buttons = Skeletons.Box.Y({
    className: `${fig}__buttons`,
    kids: [
      button(ui, {
        label: LOCALE.CONTINUE_WITH_GOOGLE,
        service: "use-google",
        type: _a.api,
        ico: "logo-google",
        priority: "secondary",
        haptic,
      }),
      button(ui, {
        label: LOCALE.CONTINUE_WITH_APPLEID,
        service: "use-apple",
        type: _a.api,
        ico: "logo-apple",
        priority: "secondary",
        haptic,
      }),
    ],
  });

  let card = Skeletons.Box.Y({
    className: `${fig}__main`,
    debug: __filename,
    kids: [
      header(
        ui,
        LOCALE.WELCOME_TO_DRUMEE || "Welcome to DRUMEE",
        LOCALE.SIGN_IN_SUBTITLE || "Log in to your sovereign workspace",
      ),
      form,
      Skeletons.Element({ content: LOCALE.OR, className: `${fig}__separator` }),
      buttons,
      Skeletons.Box.X({
        className: `${fig}__links`,
        kids: [
          Skeletons.Element({
            content: LOCALE.Q_NO_ACCOUNT || "Don't have an account?",
            className: `${fig}__text`,
          }),
          Skeletons.Element({
            content: LOCALE.START_FREE || "Start free →",
            className: `${fig}__text link`,
            on_click: () => {
              try { history.replaceState(null, '', '#/welcome/signup'); } catch (e) {}
              if (window.Welcome && _.isFunction(Welcome.loadSignup)) {
                Welcome.loadSignup();
              } else {
                location.hash = "#/welcome/signup";
              }
            },
          }),
        ],
      }),
      termsAndConditions(ui),
    ],
  });

  let a = Skeletons.Box.Y({
    className: `${fig}__wrapper`,
    kids: [card],
  });

  return a;
}

export default __skl_welcome_signup;
