const Acl = require("./acl");
const Page = require("./page");
const Data = require("./data");
const Document = require("./utils/document");
const Entity = require("./entity");
const RuntimeEnv = require("./runtimeEnv");
const Exception = require("./exception");
const FileIo = require("./file-io");
const Generator = require("./utils/generator");
const Input = require("./input");
const Mfs = require("./mfs");
const MfsTools = require("./utils/mfs");
const Output = require("./output");
const Session = require("./session");
const User = require("./user");
const {name, version, description} = require('../package.json');

module.exports = {
  Acl,
  Data,
  Document,
  Entity,
  RuntimeEnv,
  Exception,
  FileIo,
  Generator,
  Input,
  Mfs,
  MfsTools,
  Output,
  Page,
  Session,
  User,
  Info : {version, description, name},
  Utils: {
    mfs: MfsTools,
    document: Document,
    generator: Generator,
  },
};
