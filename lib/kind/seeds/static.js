
// Static Classes cannot be overloaded
const __static_classes = {
  blank: require('../../widgets/blank'),
  box: require('../../widgets/box'),
  list_smart: require('../../widgets/list/smart'),
  list_smart: require('../../widgets/list/table'),
  loader_snippet: require('libs/../../lib/snippet'),
  note: require('../../widgets/text'),
  progress: require('../../widgets/progress/media'),
  snippet: require('../../widgets/snippet'),
  spinner: require('../../widgets/spinner'),
  svg: require('../../widgets/image/svg'),
  svg_circle_percent: require('../../widgets/svg/circle-percent'),
  svg_gradient_circle: require('../../widgets/svg/gradient-circle'),
  text: require('../../widgets/text'),
  wrapper: require('../../widgets/blank')
};

module.exports = __static_classes;
