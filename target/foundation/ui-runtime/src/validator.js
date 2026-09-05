/* CJS adaptation of sources/ui-essentials/utils/validator.js::validator. */
const identRegExp = /^([a-zA-Z0-9_-])([a-zA-Z0-9.-])*$/;
const hostRegExp = /^[a-zA-Z0-9_-]+$/;
const nameRegExp = /^([a-zA-Z0-9.\-'\ xC0-xFF])+$/;
const emailRegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegExp = /^[+()\-\s\d]{3,}$/;

function string(value) {
  return String(value == null ? "" : value).trim();
}

// The source delegates e-mail/phone validation to historical String prototype
// extensions. This CJS extraction keeps their public Validator behaviour while
// using local regex implementations rather than mutating String globally.
const Validator = Object.freeze({
  require(value) { return string(value) !== ""; },
  email(value) { const text = string(value); return text === "" || emailRegExp.test(text); },
  phone(value) { const text = string(value); return text === "" || phoneRegExp.test(text); },
  emailOrIdent(value) { const text = string(value); return text === "" || emailRegExp.test(text) || identRegExp.test(text); },
  ident(value) { const text = string(value); return text === "" || identRegExp.test(text); },
  host(value) { const text = string(value); return text === "" || hostRegExp.test(text); },
  name(value) { const text = string(value); return text === "" || nameRegExp.test(text); }
});

module.exports = { Validator };
