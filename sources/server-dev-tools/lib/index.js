const { exit } = process;
const JSON_OPT = { spaces: 2, EOL: "\r\n" };
const { writeFileSync } = require(`jsonfile`);

function failed(msg) {
  console.error(msg);
  exit(1);
}
function writeConfigs(file, data, trace = 0) {
  console.log(`Writing data into ${file}`);
  if (trace) {
    console.log(data)
  }
  writeFileSync(file, data, JSON_OPT);
}

module.exports = {
  failed, JSON_OPT, writeConfigs
}
