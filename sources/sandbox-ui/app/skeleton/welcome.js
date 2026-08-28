
function welcome(l) {
  let r = {
    en: `
      Ready to explore Drumee’s features in a fun, interactive playground? Before you dive in, we’d love your feedback to help us improve. <br>
      ✨ Why join? By sharing your email, you’ll:<br>
      ✔ Get early access to new features & updates.<br>
      ✔ Be the first to know about exciting upgrades.<br>
      ✔ Help shape the future of Drumee!<br><br>
      Don’t worry—we respect your privacy and only use your email for Sandbox updates. No spam, ever!<br><br>
      Let’s make some noise—start playing! 🥁
      `,
    es: `
      ¿Listo para explorar las funciones de Drumee en un entorno interactivo y divertido? Antes de empezar, nos encantaría recibir tus comentarios para ayudarnos a mejorar. <br>
      ✨ ¿Por qué unirse? Al compartir tu correo electrónico:<br>
      ✔ Recibirás acceso anticipado a nuevas funciones y actualizaciones.<br>
      ✔ Serás el primero en enterarte de las emocionantes actualizaciones.<br>
      ✔ ¡Ayuda a dar forma al futuro de Drumee!<br><br>
      No te preocupes: respetamos tu privacidad y solo usamos tu correo electrónico para las actualizaciones de Sandbox. ¡Sin spam, nunca!<br><br>
      ¡A jugar, a hacer ruido! 🥁      `,
    fr: `
      Prêt à explorer les fonctionnalités de Drumee dans un environnement ludique et interactif ? Avant de vous lancer, nous aimerions connaître votre avis pour nous aider à nous améliorer. <br>
      ✨ Pourquoi nous rejoindre ? En partageant votre adresse e-mail, vous : <br>
      ✔ Bénéficiez d'un accès anticipé aux nouvelles fonctionnalités et mises à jour ; <br>
      ✔ Soyez parmi les premiers informés des mises à jour intéressantes ; <br>
      ✔ Contribuez à façonner l'avenir de Drumee! <br><br>
      Ne vous inquiétez pas, nous respectons votre vie privée et n'utilisons votre adresse e-mail que pour les mises à jour de Sandbox. Aucun spam, jamais ! <br><br>
      Roulement de tambour ! Commencez à jouer ! 🥁      `,
    km: `
      ត្រៀមខ្លួនដើម្បីស្វែងយល់ពីលក្ខណៈពិសេសរបស់ Drumee នៅក្នុងសួនកុមារអន្តរកម្មដ៏រីករាយហើយឬនៅ? មុនពេលដែលអ្នកជ្រមុជទឹក យើងចូលចិត្តមតិកែលម្អរបស់អ្នក ដើម្បីជួយយើងកែលម្អ។ <br>
      ✨ហេតុអ្វីត្រូវចូលរួម? តាមរយៈការចែករំលែកអ៊ីមែលរបស់អ្នក អ្នកនឹង៖<br>
      ✔ ចូលប្រើមុខងារថ្មីៗ និងបច្ចុប្បន្នភាពជាមុនសិន។<br>
      ✔ក្លាយជាមនុស្សដំបូងគេដែលដឹងអំពីការធ្វើឱ្យប្រសើរដ៏គួរឱ្យរំភើប។<br>
      ✔ជួយបង្កើតអនាគតរបស់ Drumee!<br><br>
      កុំបារម្ភ—យើងគោរពឯកជនភាពរបស់អ្នក ហើយប្រើតែអ៊ីមែលរបស់អ្នកសម្រាប់ការអាប់ដេត Sandbox ប៉ុណ្ណោះ។ គ្មានសារឥតបានការទេ!<br><br>
      ចាប់ផ្តើមលេង! 🥁
      `,
    ru: `
      Готовы исследовать возможности Drumee в увлекательной интерактивной игровой среде? Прежде чем вы окунётесь в игру, мы будем рады вашим отзывам, которые помогут нам стать лучше. <br>
      ✨ Зачем регистрироваться? Поделившись своим адресом электронной почты, вы:<br>
      ✔ Получаете ранний доступ к новым функциям и обновлениям.<br>
      ✔ Узнаёте первыми о захватывающих обновлениях.<br>
      ✔ Вносите свой вклад в будущее Drumee!<br><br>
      Не волнуйтесь — мы уважаем вашу конфиденциальность и используем ваш адрес электронной почты только для обновлений Sandbox. Никакого спама!<br><br>
      Давайте пошумим — начнём играть! 🥁      `,
    zh: `
    准备好在趣味互动的游乐场探索 Drumee 的功能了吗？在您开始体验之前，我们期待您的反馈，帮助我们改进。<br>
    ✨ 为什么要加入？分享您的电子邮件地址，您将：<br>
    ✔ 抢先体验新功能和更新。<br>
    ✔ 抢先了解激动人心的升级。<br>
    ✔ 助力塑造 Drumee 的未来！<br><br>
    别担心——我们尊重您的隐私，并且仅使用您的电子邮件地址进行沙盒更新。绝无垃圾邮件！<br><br>
    让我们一起嗨起来——开始游戏吧！🥁      `,
  }
  return r[l] || r.en
}
/**
 * 
 * @param {*} ui 
 * @param {*} opt 
 * @returns 
 */
function entry(ui) {
  const pfx = `${ui.fig.family}__entry email`;
  let args = {
    className: `${pfx} entry`,
    name: _a.email,
    value: "",
    formItem: _a.email,
    innerClass: _a.email,
    placeholder: LOCALE.ENTER_EMAIL,
    uiHandler: [ui],
    sys_pn: _a.email,
    mode: _a.interactive,
    service: _a.input
  }
  return Skeletons.Entry(args)
}

module.exports = function (ui, error) {
  const content = Skeletons.Box.Y({
    className: `${ui.fig.family}__welcome content`,
    kids: [
      Skeletons.Note({
        className: `${ui.fig.family}__main-title home`,
        content: LOCALE.SBX_INTRO_TITLE
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__welcome text`,
        content: welcome(ui.mget('lang')),
      }),
      entry(ui, { name: "email", placeholder: LOCALE.ENTER_EMAIL })
    ]
  });
  return Skeletons.Box.Y({
    className: `${ui.fig.family}__welcome container bg-gradient-animate bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500`,
    debug: __filename,
    kids: [
      Skeletons.Box.X({
        className: `${ui.fig.family}__welcome-logo header`,
        kids: [
          Skeletons.Image.Smart({
            className: `${ui.fig.family}__welcome-logo`,
            src: `/images/drumee-logo.png`,
          }),
        ]
      }),
      require("./languages")(ui),
      content,
      Skeletons.Box.X({
        className: `${ui.fig.family}__welcome content buttons`,
        kids: [
          Skeletons.Note({
            className: `${ui.fig.family}__welcome button transition-colors bg-primary text-secondary-foreground`,
            content: LOCALE.SBX_SUBSCRIBE,
            service: "subscribe"
          }),
          Skeletons.Note({
            className: `${ui.fig.family}__welcome button transition-colors bg-secondary text-secondary-foreground`,
            content: LOCALE.SBX_NO_THANKS,
            service: "try-only"
          }),
        ]
      })
    ]
  })
}