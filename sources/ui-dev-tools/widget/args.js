const argparse = require("argparse");

const parser = new argparse.ArgumentParser({
	description: "Drumee widget initializer",
	add_help: true,
});


parser.add_argument("--fig", {
	type: String,
	default: '',
	help: "figGroup.figName",
});
parser.add_argument("--dest", {
	type: String,
	default: '',
	help: "Destination dir. Must be empty",
});

parser.add_argument("--parent", {
	type: String,
	default: '',
	help: "Drumee Core Object. e.g LetcBox",
});

const args = parser.parse_args();
module.exports = args;
