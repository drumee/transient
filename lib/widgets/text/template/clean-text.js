
const { sanitize } = require('dompurify');

module.exports = function (ui) {
  let m = ui.model.toJSON();
  let c = m.content || m.value || m.label || m.text || '';
  let content = sanitize(c, { ADD_ATTR: ['target'], ALLOWED_TAGS: tags })
  let tags = ui.mget(_a.tags) || _K.allowed_tag;
  let a = `<div id="${m.widgetId}-inner" class="${m.innerClass} ${ui.fig.family} inner note-content">${content}</div>`
  return a;
};