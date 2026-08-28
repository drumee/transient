const argparse = require("argparse");

const parser = new argparse.ArgumentParser({
	description: "Drumee Server Development Toools ",
	add_help: true,
});

parser.add_argument("--endpoint", {
	type: String,
	required: true,
	help: "Endpoint name",
});

parser.add_argument("--watchDirs", {
	type: String,
	default: ".",
	help: "Comma separated dirs that WILL trigger reload on changes",
});

parser.add_argument("--baseDir", {
	type: String,
	default: process.env.DRUMEE_RUNTIME_DIR || "/srv/drumee/runtime",
	help: "Path to the backend base",
});

parser.add_argument("--watchDefault", {
	type: "int",
	default: 1,
	help: "Enable watch",
});

parser.add_argument("--watchDelay", {
	type: "int",
	default: 1000,
	help: "Delay between restart",
});

parser.add_argument("action", {
	type: String,
	default: 1000,
	help: "add|remove|list",
});

parser.add_argument("--instances", {
	type: "int",
	default: 1,
	help: "Number of instance to be forked",
});

parser.add_argument("--watchIgnore", {
	type: String,
	default: "",
	help: "Comma separated dirs that will NOT trigger reload on changes.",
});

parser.add_argument("--watchSymLinks", {
	type: "int",
	default: 1,
	help: "Watch symbolic links as well",
});

const args = parser.parse_args();
module.exports = args;