const argparse = require("argparse");

const parser = new argparse.ArgumentParser({
	description: "Drumee Server Development Toools ",
	add_help: true,
});

parser.add_argument("--endpoint", {
	type: String,
	default: "main",
	help: "Endpoint name",
});

parser.add_argument("--plugin-dir", {
	type: String,
	default: ".",
	help: "/path/to/plugin/dir",
});

parser.add_argument("action", {
	type: String,
	default: 1000,
	help: "add|remove|list",
});


const args = parser.parse_args();
module.exports = args;