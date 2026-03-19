

module.exports = {
  Close(ui, svc, cn) {
    if (svc == null) { svc = _e.close; }
    return Skeletons.Button.Icon({
      ico: "account_cross",
      className: cn || "dialog__button--close",
      service: svc,
      uiHandler: ui
    }, {
      width: 36,
      height: 36,
      padding: 12
    });
  },
  Cross(ui, svc, cn) {
    if (svc == null) { svc = _e.close; }
    return Skeletons.Button.Svg({
      ico: "account_cross",
      className: cn || "button__cross",
      service: svc,
      uiHandler: ui
    });
  },
  Spinner(ui) {
    return Skeletons.Note({
      className: _C.spinner,
      uiHandler: ui,
      partHandler: ui
    });
  }
};
