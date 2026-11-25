import assert from "node:assert/strict";
import { test } from "node:test";
import type { SQSEvent } from "aws-lambda";
import { MemoryStore } from "../src/memory.ts";
import { createWorker } from "../src/worker.ts";

const order = { id: "ord_" + "a".repeat(24), customerId: "c", items: [], totalCents: 0, status: "received" as const, createdAt: "x" };
const ev = (...bodies: { id: string; body: string }[]) =>
  ({ Records: bodies.map((b) => ({ messageId: b.id, body: b.body })) }) as unknown as SQSEvent;

test("marks the order processed", async () => {
  const store = new MemoryStore();
  await store.create({ ...order });
  const r = await createWorker({ store, log: () => {} })(ev({ id: "m1", body: JSON.stringify({ orderId: order.id }) }));
  assert.deepEqual(r.batchItemFailures, []);
  assert.equal((await store.get(order.id))?.status, "processed");
});

test("redelivery of the same message is harmless", async () => {
  const store = new MemoryStore();
  await store.create({ ...order });
  const w = createWorker({ store, log: () => {} });
  const e = ev({ id: "m1", body: JSON.stringify({ orderId: order.id }) });
  await w(e);
  assert.deepEqual((await w(e)).batchItemFailures, []);
});

test("only the bad messages are reported for retry", async () => {
  const store = new MemoryStore();
  await store.create({ ...order });
  const r = await createWorker({ store, log: () => {} })(
    ev(
      { id: "ok", body: JSON.stringify({ orderId: order.id }) },
      { id: "garbage", body: "not json" },
      { id: "missing", body: JSON.stringify({ orderId: "ord_" + "b".repeat(24) }) },
      { id: "empty", body: "{}" },
    ),
  );
  assert.deepEqual(r.batchItemFailures.map((f) => f.itemIdentifier), ["garbage", "missing", "empty"]);
});
