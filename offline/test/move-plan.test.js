#!/usr/bin/env node

/**
 * Regression tests for normalizing the mfs_move_all / mfs_copy_all result.
 *
 * The driver's get_rows unwraps a single result set into flat rows but leaves
 * several result sets nested. mfs_move_all emits more than one — the plan, plus
 * a stray set from seo_update_hub's trailing SELECT — so consumers switching on
 * `row.action` were handed arrays, matched no case, and moved no files while the
 * database reported success. Cross-workspace moves left files behind for seven
 * months without a single error.
 *
 * Standalone runner (no test framework in this repo): `node <thisfile>`.
 */

const assert = require("assert");
const { movePlanRows } = require("../../service/private/_move-plan");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function recorder() {
  const warnings = [];
  return { ctx: { warn: (message) => warnings.push(message) }, warnings };
}

const moveRow = {
  action: "move",
  nid: "file-src",
  des_id: "file-dst",
  src_mfs_root: "/source",
  des_mfs_root: "/destination",
};
const showRow = { action: "show", nid: "file-dst" };
const seoRow = { updated_words: 0, updated_register: 0, status: "success" };

test("unwraps a plan nested behind a second result set", () => {
  const { ctx } = recorder();
  const rows = movePlanRows([[moveRow, showRow], seoRow], ctx);
  assert.deepStrictEqual(rows, [moveRow, showRow]);
});

test("leaves an already-flat plan alone", () => {
  // mfs_copy_all emits one result set and has always worked; normalizing must
  // not disturb it.
  const { ctx, warnings } = recorder();
  assert.deepStrictEqual(movePlanRows([moveRow, showRow], ctx), [moveRow, showRow]);
  assert.strictEqual(warnings.length, 0);
});

test("accepts a single-row plan the driver flattened to a bare object", () => {
  const { ctx } = recorder();
  assert.deepStrictEqual(movePlanRows([moveRow, seoRow], ctx), [moveRow]);
});

test("drops the SEO result set and says so", () => {
  const { ctx, warnings } = recorder();
  movePlanRows([[moveRow], seoRow], ctx);
  assert.strictEqual(warnings.length, 1);
  assert.match(warnings[0], /non-plan rows/);
});

test("keeps a failed row so its sqlstate still reaches the log", () => {
  // mfs_create_node rolls back inside mfs_move_all and reports through a result
  // set of its own; transact() reads those rows.
  const failed = { failed: 1, sqlstate: "40001", message: "deadlock" };
  const { ctx } = recorder();
  assert.deepStrictEqual(movePlanRows([[moveRow], failed], ctx), [moveRow, failed]);
});

test("warns when nothing actionable came back", () => {
  const { ctx, warnings } = recorder();
  assert.deepStrictEqual(movePlanRows([seoRow], ctx), []);
  assert.strictEqual(warnings.length, 1);
  assert.match(warnings[0], /no actionable row/);
});

test("warns on an empty result, which is how call_proc reports failure", () => {
  // call_proc routes a failed CALL through _handleError: it logs and returns
  // undefined instead of throwing, so silence here would look like success.
  for (const empty of [[], null, undefined]) {
    const { ctx, warnings } = recorder();
    assert.deepStrictEqual(movePlanRows(empty, ctx), []);
    assert.strictEqual(warnings.length, 1, `no warning for ${JSON.stringify(empty)}`);
    assert.match(warnings[0], /no actionable row/);
  }
});

test("refuses a nested array rather than passing it off as a row", () => {
  // Unreachable today: get_rows nests at most one level, because its deeper
  // branch tests `typeof i[0] !== 'array'` and typeof never yields "array".
  // Should that typo ever be fixed, arrays must not silently re-enter the plan.
  const { ctx } = recorder();
  assert.deepStrictEqual(movePlanRows([[[moveRow]]], ctx), []);
});

test("survives null entries among the rows", () => {
  const { ctx } = recorder();
  assert.deepStrictEqual(movePlanRows([[moveRow, null], seoRow], ctx), [moveRow]);
});

test("works without a context, for callers that have no logger", () => {
  assert.deepStrictEqual(movePlanRows([[moveRow], seoRow]), [moveRow]);
  assert.deepStrictEqual(movePlanRows(null), []);
});

(async () => {
  let passed = 0;
  console.log("");
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ok  - ${name}`);
      passed++;
    } catch (error) {
      console.log(`  FAIL - ${name}`);
      console.log(`         ${error.message}`);
    }
  }
  console.log(`\n${passed}/${tests.length} passed\n`);
  process.exit(passed === tests.length ? 0 : 1);
})();
