// ======================================================= *
//   Copyright Xialia.com  2011-2024
//   FILE : /Users/somanos/devel/sandbox-ui/app/main/skeleton/index.js
//   TYPE : Skelton
// =========================================================**/
const { filesize } = Drumee.utils();

function tips(ui, key, ico) {
  let title = LOCALE[key];
  let text = LOCALE[`${key}_TIPS`]
  return Skeletons.Box.Y({
    className: `${ui.fig.family}__tips container`,
    kids: [
      Skeletons.Button.Svg({
        className: `${ui.fig.family}__tips icon`,
        ico,
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__tips title`,
        content: title
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__tips text`,
        content: text
      }),
    ]
  })
}

function limitations(ui, text) {
  return Skeletons.Box.Y({
    className: `${ui.fig.family}__tips container`,
    kids: [
      Skeletons.Note({
        className: `text`,
        content: text
      }),
    ]
  })
}

/**
 * 
 * @param {*} ui 
 * @returns 
 */

function __skl_sandbox_tips(ui) {
  let { private_hub, share_hub, team_call, disk } = ui.quota || {};
  disk = filesize(disk);
  team_call = Dayjs.duration(team_call, 'seconds').$d.minutes;

  const a = Skeletons.Box.Y({
    className: `${ui.fig.family}__container`,
    kids: [
      require("./languages")(ui),
      Skeletons.Note({
        className: `${ui.fig.family}__main-title`,
        content: LOCALE.SBX_INTRO_TITLE
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__main-text`,
        content: LOCALE.SBX_INTRO_SUBTITLE
      }),
      Skeletons.Box.G({
        className: `${ui.fig.family}__features container`,
        kids: [
          tips(ui, "SBX_FILE_MANAGER", "folder"),
          tips(ui, "SBX_INTERNAL_SHARE", "desktop_mysharing"),
          tips(ui, "SBX_EXTERNAL_SHARE", "desktop_sharing"),
        ]
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__warning title`,
        content: LOCALE.WARNING
      }),
      Skeletons.Box.Y({
        className: `${ui.fig.family}__limitations container`,
        kids: [
          limitations(ui, LOCALE.SBX_USAGE_TIPS),
          limitations(ui, LOCALE.SBX_LIMITATIONS.format(disk, team_call, private_hub, share_hub)),
          limitations(ui, LOCALE.PERMISSION_REMINDER)

        ]
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__main-text usage-condition`,
        content: LOCALE.SBX_ACCEPT_CONDITIONS,
        sys_pn: "usage-condition"
      }),
    ]
  });

  return [a];
}
module.exports = __skl_sandbox_tips;