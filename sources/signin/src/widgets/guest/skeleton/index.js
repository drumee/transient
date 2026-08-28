const topNav = require('./top-nav');
const header = require('./header');
const splitView = require('./split-view');
const externalView = require('./external-view');
const banner = require('./banner');

/**
 * Page assembly for the anonymous guest landing page:
 *
 *   __nav      sticky top app bar          (both scopes)
 *   __body     workspace header + the scope's main view
 *   __banner   sticky bottom conversion banner (both scopes)
 *
 * The middle is what the two Figma frames disagree on:
 *
 *   internal  1602:76946  redacted file grid + chat behind a Content Restricted
 *                         card  (./split-view.js)
 *   external  1602:77081  the shared folder's window: tabs, filters, folder and
 *                         file grid, Conversation panel  (./external-view.js)
 *
 * Nav, header and banner are shared; the header itself swaps copy and accent by
 * scope. The root carries data-scope so the skin can recolour without either
 * skeleton knowing about the other.
 *
 * @param {LetcBox} ui  the signin_guest instance
 */
function __skl_signin_guest(ui) {
  const fig = ui.fig.family;
  const mainView = ui.isExternal() ? externalView : splitView;

  return Skeletons.Box.Y({
    className: `${fig}__page`,
    debug: __filename,
    kids: [
      topNav(ui),
      Skeletons.Box.Y({
        className: `${fig}__body`,
        kids: [
          header(ui),
          mainView(ui),
        ],
      }),
      banner(ui),
    ],
  });
}

export default __skl_signin_guest;
