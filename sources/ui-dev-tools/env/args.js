const argparse = require("argparse");

const {
  USER,
} = process.env;

const parser = new argparse.ArgumentParser({
  description: "Ui-dev-tools Helper",
  add_help: true,
});

parser.add_argument("--user", {
  default:  USER,
  type: String,
  required: true,
});

parser.add_argument("--endpoint", {
  type: String,
  default:  "main",
});

parser.add_argument("--type", {
  type: String,
  default:  "app",
  help: "app | plugin",
});

parser.add_argument("--runtime-dir", {
  type: String,
  default:  "/srv/drumee/runtime",
});

parser.add_argument("--plugin", {  
  type: String,
  default: "",
});

parser.add_argument("--build-mode", {  
  type: String,
  default: "development",
});

parser.add_argument("--output", {  
  type: String,
  default: "drumee_env",
});

parser.add_argument("--server", {  
  type: String,
  default: "",
});

parser.add_argument("--base-dir", {  
  type: String,
  required: true,
});

const args = parser.parse_args();


module.exports = { args, parser };