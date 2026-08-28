const __account_languages = function (_ui_) {
  const { static } = bootstrap();
  const host = Host.get(_a.vhost);
  const pfx = _ui_.fig.family;
  let kids = Array.from(Platform.get('intl')).map((l) =>
    Skeletons.Button.Label({
      ico: "common_placeholder",
      className: `${pfx}__language-item`,
      label: LOCALE[l],
      value: l,
      labelFirst: 1,
      service: 'change-lang',
      uiHandler: [_ui_],
      svgSource: `https://${host}${static}images/flags/languages_${l}.svg`
    }))

  const items = Skeletons.Box.Y({
    className: `${pfx}__menu-items`,
    flow: _a.vertical,
    kidsOpt: {
      className: `${pfx}__menu-item`,
    },
    kids
  });

  const lang = _ui_.mget(_a.lang) || 'en';
  const svgSource = `https://${host}${static}images/flags/languages_${lang}.svg`;
  const trigger = Skeletons.Button.Svg({
    ico: "common_placeholder",
    className: `${pfx}__menu-language-trigger`,
    value: lang,
    svgSource
  })

  const menu = Skeletons.Box.X({
    className: `${pfx}__menu-container`,
    kids: [{
      kind: KIND.menu.topic,
      className: `${pfx}__menu-ui shadow-xl`,
      itemsClass: "shadow-xl",
      flow: _a.y,
      opening: _e.click,
      persistence: _a.once,
      trigger,
      items,
    }]
  });


  return menu;
};

module.exports = __account_languages;
