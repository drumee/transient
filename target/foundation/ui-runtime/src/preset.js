/* Selective extraction of ui-core/letc/preset/{button,template}.js. */
function createPreset(Skeletons) {
  return Object.freeze({
    Button: Object.freeze({
      Close(ui, service = "close", className) {
        return Skeletons.Button.Icon({ ico: "account_cross", className: className || "dialog__button--close", service, uiHandler: ui }, { width: 36, height: 36, padding: 12 });
      },
      Cross(ui, service = "close", className) {
        return Skeletons.Button.Svg({ ico: "account_cross", className: className || "button__cross", service, uiHandler: ui });
      },
      Spinner(ui) { return Skeletons.Note({ className: "spinner", uiHandler: ui, partHandler: ui }); }
    }),
    ConfirmButtons(ui, options = {}, yesOptions = {}) {
      return Skeletons.Box.X({
        className: `${ui.fig.family}__buttons-wrapper buttons u-ai-center`,
        kids: [
          Skeletons.Note({ service: options.cancelService || "close-popup", content: options.cancelLabel || "Cancel", uiHandler: ui, className: `${ui.fig.family}__button-cancel ${options.cancelBtnClass || ""}`, ...yesOptions }),
          Skeletons.Note({ service: options.confirmService || "submit", content: options.confirmLabel || "Yes", uiHandler: ui, className: `${ui.fig.family}__button-confirm ${options.confirmBtnClass || ""}` })
        ]
      });
    },
    List: Object.freeze({
      Orange_e: Object.freeze({ alwaysVisible: true, size: "2px", opacity: "1", color: "rgb(250, 133, 64)", distance: "1px" })
    }),
    Utils: Object.freeze({ Spinner(ui) { return { kind: "spinner", uiHandler: ui }; } })
  });
}

const Template = Object.freeze({
  Xmlns(chartId) {
    return `<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#--icon-${chartId}"></use>`;
  },
  SvgText(text, className = "svg-text") {
    const value = String(text || "").slice(0, 4);
    const width = Math.max(11, value.length * 5);
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 28 29"><rect y="14" width="${width}" height="10" rx="4"></rect><text x="2" y="21">${value}</text></svg>`;
  }
});

module.exports = { Template, createPreset };
