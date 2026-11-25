import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function tfFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === ".terraform" ? [] : tfFiles(p)) : p.endsWith(".tf") ? [p] : [];
  });
}
const all = tfFiles("terraform").map((p) => [p, readFileSync(p, "utf8")] as const);

test("no IAM statement uses a wildcard action", () => {
  for (const [p, s] of all) assert.ok(!/actions\s*=\s*\[[^\]]*"\*"/.test(s), `${p} has a wildcard action`);
});

test("every Lambda has a log group with retention and X-Ray tracing on", () => {
  const fn = all.find(([p]) => p.endsWith("modules/function/main.tf"))![1];
  assert.match(fn, /aws_cloudwatch_log_group/);
  assert.match(fn, /retention_in_days/);
  assert.match(fn, /mode\s*=\s*"Active"/);
});

test("the table has point-in-time recovery and the queue has a dead-letter queue", () => {
  const d = all.find(([p]) => p.endsWith("modules/data/main.tf"))![1];
  assert.match(d, /point_in_time_recovery\s*{\s*enabled\s*=\s*true/);
  assert.match(d, /redrive_policy/);
  assert.match(d, /sse_enabled|kms_master_key_id|sqs_managed_sse_enabled/);
});

test("the API stage is throttled and logs access", () => {
  const a = all.find(([p]) => p.endsWith("modules/api/main.tf"))![1];
  assert.match(a, /throttling_burst_limit/);
  assert.match(a, /access_log_settings/);
});
