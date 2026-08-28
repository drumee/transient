export function __skl_welcome_signup_password (_ui_) {

  let a = Skeletons.Box.Y({
    className  : `${passwordFig}__items password`,
    debug      : __filename,
    kids       : [
      password,
      nextBtn,
      msgBox
    ]
  })

  return a;

}

export default __skl_welcome_signup_password