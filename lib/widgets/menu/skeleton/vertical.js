// ==================================================================== *
//   Copyright Xialia.com  2011-2018
//   FILE : ../src/drumee/libs/reader/menu/skeleton/vertical
//   TYPE :
// ==================================================================== *

// ===========================
const _item_class    = "menu-items";
const _trigger_class = "menu-trigger";
// ===========================================================
// __skl_menu_vertical
//
// @param [Object] view
// @param [Object] opt
//
// @return [Object]
//
// ===========================================================
const __skl_menu_vertical = function(view, opt) {
  const a = [
    SKL_Box_H(view,{
      handler   : {
        ui      : view
      },
      className : _trigger_class,
      sys_pn    : _a.trigger,
      radio     : _a.parent,
      kidsOpt   : {
        radio     : _a.parent,
        handler   : {
          ui      : view
        }
      }
    }),
    SKL_Box_V(view,{
      //wrapper   : 1
      radio     : _a.parent,
      className : _item_class,
      sys_pn    : _a.items
    })
  ];
  return a;
};
module.exports = __skl_menu_vertical;
