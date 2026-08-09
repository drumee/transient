#!/usr/bin/env node

/**
 * Regression tests for selecting the physical move row from mfs_move_all.
 *
 * await_proc can return a raw multi-result shape such as
 * [statusRow, [operationRows...]]. The file-thread move saga needs the
 * operation row's des_id before it can promote the staged bytes or compensate.
 *
 * Standalone runner (no test framework in this repo): `node <thisfile>`.
 */

const assert = require("assert");
const { readFileSync } = require("fs");
const { join } = require("path");

const {
  findMfsMoveResult,
  isCompleteMfsThreadMigration,
  waitForMfsThreadMigration,
} = require("../../service/lib/mfs-move-result");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const moveRow = {
  action: "move",
  nid: "source-file",
  des_id: "destination-file",
  category: "document",
  src_mfs_root: "/source",
  des_mfs_root: "/destination",
};

test("selects a move row from a flat operation array", () => {
  assert.strictEqual(findMfsMoveResult([
    { action: "show", nid: "destination-file" },
    moveRow,
  ], "source-file"), moveRow);
});

test("selects a move row from a raw nested multi-result", () => {
  const result = [
    { affectedRows: 0, warningCount: 0 },
    [{ action: "showone", nid: "destination-file" }, moveRow],
  ];
  assert.strictEqual(findMfsMoveResult(result, "source-file"), moveRow);
});

test("searches later result sets and ignores metadata packets", () => {
  const result = [
    [{ action: "show", nid: "other-file" }],
    { serverStatus: 2 },
    [[{ action: "same", nid: "source-file" }], [moveRow]],
  ];
  assert.strictEqual(findMfsMoveResult(result, "source-file"), moveRow);
});

test("returns null for empty or metadata-only results", () => {
  assert.strictEqual(findMfsMoveResult(null, "source-file"), null);
  assert.strictEqual(findMfsMoveResult([], "source-file"), null);
  assert.strictEqual(findMfsMoveResult([{ affectedRows: 1 }], "source-file"), null);
});

test("does not select a move row for a different source nid", () => {
  assert.strictEqual(findMfsMoveResult([moveRow], "another-file"), null);
});

test("polls source-only state until destination migration becomes visible", async () => {
  const states = [
    { sourcePosition: { file_thread_id: "thread-id" }, destinationPosition: null },
    {
      sourcePosition: null,
      destinationPosition: {
        file_thread_id: "thread-id",
        root_identity_count: 1,
        stale_child_identity_count: 0,
      },
    },
  ];
  let reads = 0;
  let delays = 0;

  const result = await waitForMfsThreadMigration(
    async () => states[Math.min(reads++, states.length - 1)],
    { attempts: 5, delay: async () => { delays += 1; } }
  );

  assert.deepStrictEqual(result, states[1]);
  assert.strictEqual(reads, 2);
  assert.strictEqual(delays, 1);
});

test("keeps ambiguous both and neither states read-only until the bound", async () => {
  for (const state of [
    {
      sourcePosition: { file_thread_id: "thread-id" },
      destinationPosition: { file_thread_id: "thread-id" },
    },
    { sourcePosition: null, destinationPosition: null },
  ]) {
    let reads = 0;
    let delays = 0;
    const result = await waitForMfsThreadMigration(
      async () => { reads += 1; return state; },
      { attempts: 3, delay: async () => { delays += 1; } }
    );
    assert.strictEqual(result, state);
    assert.strictEqual(reads, 3);
    assert.strictEqual(delays, 2);
  }
});

test("returns persistent source-only state after the bounded attempt count", async () => {
  const state = { sourcePosition: { file_thread_id: "thread-id" }, destinationPosition: null };
  let reads = 0;
  let delays = 0;
  const result = await waitForMfsThreadMigration(
    async () => { reads += 1; return state; },
    { attempts: 3, delay: async () => { delays += 1; } }
  );
  assert.strictEqual(result, state);
  assert.strictEqual(reads, 3);
  assert.strictEqual(delays, 2);
});

test("requires a destination-only thread with valid root and child identities", () => {
  const validDestination = {
    file_thread_id: "thread-id",
    root_identity_count: "1",
    stale_child_identity_count: "0",
  };
  assert.strictEqual(isCompleteMfsThreadMigration({
    sourcePosition: null,
    destinationPosition: validDestination,
  }), true);
  assert.strictEqual(isCompleteMfsThreadMigration({
    sourcePosition: { file_thread_id: "thread-id" },
    destinationPosition: validDestination,
  }), false);
  assert.strictEqual(isCompleteMfsThreadMigration({
    sourcePosition: null,
    destinationPosition: { ...validDestination, root_identity_count: 0 },
  }), false);
  assert.strictEqual(isCompleteMfsThreadMigration({
    sourcePosition: null,
    destinationPosition: { ...validDestination, stale_child_identity_count: 1 },
  }), false);
  assert.strictEqual(isCompleteMfsThreadMigration({
    sourcePosition: null,
    destinationPosition: null,
  }), false);
});

test("the saga uses the selector for forward and compensation plans", () => {
  const media = readFileSync(join(__dirname, "..", "..", "service", "private", "media.js"), "utf8");
  const selectorCalls = media.match(/findMfsMoveResult\(/g) || [];
  assert.strictEqual(selectorCalls.length, 2, "both mfs_move_all paths must select from the raw result");
});

test("the forward saga uses read-only convergence polling without a write retry", () => {
  const media = readFileSync(join(__dirname, "..", "..", "service", "private", "media.js"), "utf8");
  assert.match(media, /waitForMfsThreadMigration\(/);
  assert.doesNotMatch(media, /channel_migrate_moved_scope/);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ok  - ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL - ${name}`);
      console.error(`         ${error && error.message}`);
    }
  }

  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
