// Send beta announcement to users in batches

const { resolve, join } = require('path');
const { readFileSync, writeFileSync, existsSync, appendFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { ArgumentParser } = require('argparse');
const { sysEnv, Mariadb, Messenger } = require('@drumee/server-essentials');

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const parser = new ArgumentParser({
    description: 'Drumee Beta Announcement Mailer'
  });

  parser.add_argument('--batch-size', {
    type: 'int',
    default: 50,
    help: 'Number of emails per batch (default: 50)'
  });

  parser.add_argument('--pause-time', {
    type: 'int',
    default: 3000,
    help: 'Pause time between batches in milliseconds (default: 3000)'
  });

  parser.add_argument('--pool-threshold', {
    type: 'int',
    default: 100,
    help: 'Minimum pool size before pausing (default: 100)'
  });

  parser.add_argument('--template', {
    type: String,
    default: join(__dirname, '../templates/index.html'),
    help: 'Path to the template'
  });

  parser.add_argument('--pool-wait-time', {
    type: 'int',
    default: 30000,
    help: 'Wait time when pool is low in milliseconds (default: 30000)'
  });

  return parser.parse_args();
}

const args = parseArgs();

/**
 * Configuration
 */
const CONFIG = {
  BATCH_SIZE: args.batch_size,           // Emails per batch (from CLI args)
  BATCH_DELAY: args.pause_time,          // Pause between batches (from CLI args)
  POOL_THRESHOLD: args.pool_threshold,   // Minimum pool size before pausing
  POOL_WAIT_TIME: args.pool_wait_time,   // Wait time when pool is low
  SUBJECT: 'Drumee Beta is live!',
  INPUT_FILE: resolve(__dirname, '../data/recipients.csv'),
  SENT_LOG: resolve(__dirname, '../data/sent.csv'),
  FAILED_LOG: resolve(__dirname, '../data/failed.csv'),
  TEMPLATE: resolve(__dirname, '../templates/beta-announcement.html')
};

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check schema pool availability to ensure users can sign up successfully
 */
async function checkSchemaPool(yp) {
  try {
    // Check drumate pool
    const drumatePool = await yp.await_query(
      "SELECT COUNT(*) as count FROM entity WHERE area='pool' AND type='drumate'"
    );
    const drumateCount = Number(drumatePool?.count || 0);

    // Check hub pool
    const hubPool = await yp.await_query(
      "SELECT COUNT(*) as count FROM entity WHERE area='pool' AND type='hub'"
    );
    const hubCount = Number(hubPool?.count || 0);
    console.log("AAA:85", { drumateCount, hubPool });
    return {
      drumate: drumateCount,
      hub: hubCount,
      available: Math.min(drumateCount, hubCount)
    };
  } catch (error) {
    console.error('Failed to check schema pool:', error.message);
    return { drumate: 0, hub: 0, available: 0 };
  }
}

/**
 * Wait for schema pool to refill if needed
 * If yp is null (no DB access), skip pool checking
 */
async function waitForPool(yp, batchNum) {
  // Skip pool checking if no database connection
  if (!yp) {
    return { drumate: 0, hub: 0, available: 0, checked: false };
  }

  const pool = await checkSchemaPool(yp);

  console.log(`  Schema Pool: drumate=${pool.drumate}, hub=${pool.hub}`);

  if (pool.available < CONFIG.POOL_THRESHOLD) {
    console.log(`  Pool low (${pool.available} < ${CONFIG.POOL_THRESHOLD})`);
    console.log(`  Waiting ${CONFIG.POOL_WAIT_TIME / 1000}s for pool to refill...`);
    await sleep(CONFIG.POOL_WAIT_TIME);

    // Re-check after waiting
    const newPool = await checkSchemaPool(yp);
    console.log(`  Pool after wait: drumate=${newPool.drumate}, hub=${newPool.hub}`);

    if (newPool.available < CONFIG.POOL_THRESHOLD) {
      console.log(`  Pool still low! Consider stopping and running later.`);
      console.log(`  Press Ctrl+C to stop, or will continue after 10s...`);
      await sleep(10000);
    }
  }

  return { ...pool, checked: true };
}

/**
 * Initialize log files
 */
function initLogFiles() {
  // Create sent.csv header if not exists
  if (!existsSync(CONFIG.SENT_LOG)) {
    writeFileSync(CONFIG.SENT_LOG, 'No,Email,Name,Timestamp\n', 'utf8');
  }

  // Create failed.csv header if not exists
  if (!existsSync(CONFIG.FAILED_LOG)) {
    writeFileSync(CONFIG.FAILED_LOG, 'No,Email,Name,Error,Timestamp\n', 'utf8');
  }
}

/**
 * Load recipients from CSV
 * CSV format: No,Email,Name
 */
function loadRecipients() {
  if (!existsSync(CONFIG.INPUT_FILE)) {
    console.error(`\nInput file not found: ${CONFIG.INPUT_FILE}`);
    console.error(`\nPlease create recipients.csv with format:`);
    console.error(`  No,Email,Name`);
    console.error(`  1,user@example.com,John Doe`);
    console.error(`\nOptions:`);
    console.error(`  1. Copy test file: cp data/recipients-test.csv data/recipients.csv`);
    console.error(`  2. Export from Google Sheets as CSV`);
    console.error(`  3. Create manually with above format\n`);
    throw new Error(`Input file not found: ${CONFIG.INPUT_FILE}`);
  }

  const csvContent = readFileSync(CONFIG.INPUT_FILE, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`✓ Loaded ${records.length} recipients from CSV`);
  return records;
}

/**
 * Load already sent emails to support resume
 */
function loadSentEmails() {
  if (!existsSync(CONFIG.SENT_LOG)) {
    return new Set();
  }

  const csvContent = readFileSync(CONFIG.SENT_LOG, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const sentEmails = new Set(records.map(r => r.Email));
  console.log(`✓ Found ${sentEmails.size} already sent emails (will skip)`);
  return sentEmails;
}

/**
 * Log sent email
 */
function logSent(record) {
  const row = stringify([[
    record.No,
    record.Email,
    record.Name,
    new Date().toISOString()
  ]]);
  appendFileSync(CONFIG.SENT_LOG, row, 'utf8');
}

/**
 * Log failed email
 */
function logFailed(record, error) {
  const row = stringify([[
    record.No,
    record.Email,
    record.Name,
    error.message || String(error),
    new Date().toISOString()
  ]]);
  appendFileSync(CONFIG.FAILED_LOG, row, 'utf8');
}

/**
 * Send single email
 */
async function sendEmail(record) {
  const { Email, Name } = record;
  const { main_domain } = sysEnv();

  // Prepare template data
  const data = {
    name: Name || '',
    email: Email,
    domain: main_domain,
    year: new Date().getFullYear()
  };

  try {
    // Create messenger instance
    const msg = new Messenger({
      subject: CONFIG.SUBJECT,
      recipient: Email,
      handler: (error) => {
        console.error(`✗ Email error for ${Email}:`, error);
      }
    });

    // Render HTML from template
    let html;
    if (args.template && existsSync(args.template)) {
      CONFIG.TEMPLATE = args.template;
    }
    if (existsSync(CONFIG.TEMPLATE)) {
      
      html = msg.renderFrom(CONFIG.TEMPLATE, data);
    } else {
      // Fallback: simple HTML if template not ready yet
      html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body>
          <h1>Drumee Beta is live!</h1>
          <p>Hello ${Name || 'there'},</p>
          <p>We're excited to announce that Drumee Beta is now live!</p>
          <p><a href="https://app.drumee.org">Join now</a></p>
          <p>Best regards,<br>Drumee Team</p>
        </body>
        </html>
      `;
    }

    // Send email
    await msg.send({ from: "no-reply@drumee.org", html });

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Send emails in batches
 */
async function sendBatch(recipients, yp) {
  const total = recipients.length;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const startTime = Date.now();

  console.log(`\nStarting to send ${total} emails in batches of ${CONFIG.BATCH_SIZE}...\n`);

  for (let i = 0; i < recipients.length; i += CONFIG.BATCH_SIZE) {
    const batch = recipients.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / CONFIG.BATCH_SIZE);

    // Calculate progress and ETA
    const progress = ((i / total) * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (elapsed > 0) ? (i / elapsed) : 0;
    const remaining = total - i;
    const eta = (rate > 0) ? (remaining / rate) : 0;
    const etaMin = Math.floor(eta / 60);
    const etaSec = Math.floor(eta % 60);

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} emails) - Progress: ${progress}% - ETA: ${etaMin}m ${etaSec}s`);

    // Check schema pool before each batch
    await waitForPool(yp, batchNum);

    // Process batch
    for (const record of batch) {
      const { Email, Name } = record;

      try {
        const result = await sendEmail(record);

        if (result.success) {
          logSent(record);
          sent++;
          console.log(`  ✓ Sent to: ${Email} (${Name})`);
        } else {
          logFailed(record, result.error);
          failed++;
          console.log(`  ✗ Failed: ${Email} (${Name}) - ${result.error.message}`);
        }
      } catch (error) {
        logFailed(record, error);
        failed++;
        console.log(`  ✗ Error: ${Email} (${Name}) - ${error.message}`);
      }
    }

    // Delay between batches (except last batch)
    if (i + CONFIG.BATCH_SIZE < recipients.length) {
      console.log(`  Waiting ${CONFIG.BATCH_DELAY / 1000}s before next batch...\n`);
      await sleep(CONFIG.BATCH_DELAY);
    }
  }

  return { total, sent, failed, skipped };
}

/**
 * Main execution
 */
async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Drumee Beta Announcement Mailer       ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Display configuration
  console.log('Configuration:');
  console.log(`- Batch size: ${CONFIG.BATCH_SIZE} emails`);
  console.log(`- Pause time: ${CONFIG.BATCH_DELAY}ms (${CONFIG.BATCH_DELAY / 1000}s)`);
  console.log(`- Pool threshold: ${CONFIG.POOL_THRESHOLD}`);
  console.log(`- Pool wait time: ${CONFIG.POOL_WAIT_TIME}ms (${CONFIG.POOL_WAIT_TIME / 1000}s)\n`);

  let yp = null;
  let poolCheckingEnabled = false;

  // Try to initialize database connection for pool checking
  console.log('Connecting to database...');

  try {
    yp = new Mariadb({ name: 'yp', user: process.env.USER });

    // Test connection with a simple query
    await yp.await_query("SELECT 1");

    console.log('✓ Database connected');
    console.log('✓ Schema pool checking: ENABLED\n');
    poolCheckingEnabled = true;
  } catch (dbError) {
    console.warn('Database connection failed');
    console.warn('Schema pool checking: DISABLED');
    console.warn('Script will continue without pool checking.');
    console.warn('Note: Pool checking requires root/www-data permissions.');
    console.warn('For production 34k send, run as root to enable pool checking.\n');
    yp = null;
    poolCheckingEnabled = false;
  }

  try {
    // Initialize log files
    initLogFiles();

    // Load data
    const allRecipients = loadRecipients();
    const sentEmails = loadSentEmails();

    // Filter out already sent
    const recipients = allRecipients.filter(r => !sentEmails.has(r.Email));

    if (recipients.length === 0) {
      console.log('✓ All emails have been sent already!');
      return;
    }

    console.log(`Status:`);
    console.log(`- Total in CSV: ${allRecipients.length}`);
    console.log(`- Already sent: ${sentEmails.size}`);
    console.log(`- To send: ${recipients.length}\n`);

    // Check initial pool status (if DB available)
    if (poolCheckingEnabled && yp) {
      console.log('Checking initial schema pool status...');
      const initialPool = await checkSchemaPool(yp);
      console.log(`- Drumate pool: ${initialPool.drumate}`);
      console.log(`- Hub pool: ${initialPool.hub}`);
      console.log(`- Available: ${initialPool.available}\n`);

      if (initialPool.available < CONFIG.POOL_THRESHOLD) {
        console.log(`WARNING: Pool size (${initialPool.available}) is below threshold (${CONFIG.POOL_THRESHOLD})`);
        console.log(`Users may not be able to sign up immediately after receiving emails!`);
        console.log(`Recommend waiting for pool to refill or proceeding slowly.\n`);
      }
    }

    // Confirm before sending
    console.log('Press Ctrl+C within 5 seconds to cancel...');
    await sleep(5000);

    // Send emails with pool checking (if enabled)
    const stats = await sendBatch(recipients, yp);

    // Summary
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Summary                               ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`  Total processed: ${stats.total}`);
    console.log(`  ✓ Sent: ${stats.sent}`);
    console.log(`  ✗ Failed: ${stats.failed}`);
    console.log(`\n  Logs saved to:`);
    console.log(`    - ${CONFIG.SENT_LOG}`);
    console.log(`    - ${CONFIG.FAILED_LOG}\n`);

    // Final pool check (if enabled)
    if (poolCheckingEnabled && yp) {
      console.log('Final schema pool status:');
      const finalPool = await checkSchemaPool(yp);
      console.log(`- Drumate pool: ${finalPool.drumate}`);
      console.log(`- Hub pool: ${finalPool.hub}`);
      console.log(`- Available: ${finalPool.available}\n`);
    }

  } catch (error) {
    console.error('\nFatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { sendEmail, sendBatch, checkSchemaPool, waitForPool };