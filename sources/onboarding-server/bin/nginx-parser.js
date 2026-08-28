#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const { join } = require('path');
const argparse = require("argparse");

const parser = new argparse.ArgumentParser({
  description: "Drumee Shell ",
  add_help: true,
});

parser.add_argument("--age", {
  type: "int",
  default: 300, /** 5 minutes */
  help: "Max age of row to keep",
});

parser.add_argument("--input", {
  type: String,
  default: '/var/log/nginx/access.log',
  help: "Input file",
});

parser.add_argument("--status", {
  type: "int",
  default: 200,
  help: "Status",
});

parser.add_argument("--url", {
  type: String,
  help: "Match url",
});

parser.add_argument("--format", {
  type: String,
  default: "combined",
  help: "(main|combined)",
});

parser.add_argument("--verbose", {
  type: 'int',
  default: 1,
  help: "Verbosity",
});


parser.add_argument("--output", {
  type: String,
  default: '',
  help: "Output file",
});


const options = parser.parse_args();

const LOG_PATTERNS = {
  combined: /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) ([^"]+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/,
  main: /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) ([^"]+) (\S+)" (\d+) (\d+)$/
};

let MATCH_URL

if (options.url) {
  MATCH_URL = new RegExp(options.url)
}

/**
 * 
 * @returns 
 */
function nginxTimeToUnix(timeStr) {
  return Math.floor(new Date(
    timeStr.replace(/(\d+)\/([A-Za-z]+)\/(\d+):(\d+):(\d+):(\d+)/,
      '$3 $2 $1 $4:$5:$6')
  ).getTime() / 1000)
}
/**
 * 
 * @returns 
 */
async function parseLogFile() {
  const fileStream = fs.createReadStream(options.input);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const results = [];
  const pattern = LOG_PATTERNS[options.format];
  const now = new Date().getTime() / 1000
  for await (const line of rl) {
    const match = line.match(pattern);
    if (match) {
      const timestamp = nginxTimeToUnix(match[4]);
      const url = match[6];
      const entry = {
        remoteAddr: match[1],
        remoteUser: match[2],
        timeLocal: match[4],
        timestamp,
        method: match[5],
        url,
        protocol: match[7],
        status: parseInt(match[8], 10),
        bytesSent: parseInt(match[9], 10),
        referrer: match[10] || '-',
        user_agent: match[11] || '-'
      };
      if (entry.status !== options.status) continue;
      if ((now - timestamp) > options.age) continue;
      if (MATCH_URL && !MATCH_URL.test(url)) continue;
      results.push(entry);
    }
  }

  return results;
}

async function main() {
  try {
    const data = await parseLogFile();

    if (!data.length) return;

    if (options.verbose) {
      console.log(`Found ${data.length} log entries`);
    }
    if (options.output) {
      let file = join(options.output, `${data[0].timestamp}.json`)
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      if (options.verbose) {
        console.log(`\nData saved to ${file}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}