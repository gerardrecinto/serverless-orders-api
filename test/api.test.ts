import assert from "node:assert/strict";
import { test } from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createApi, orderIdFor } from "../src/api.ts";
import { MemoryPublisher, MemoryStore } from "../src/memory.ts";

function setup() {
  const store = new MemoryStore();
  const publisher = new MemoryPublisher();
  const logs: Record<string, unknown>[] = [];
  const api = createApi({ store, publisher, log: (f) => logs.push(f), now: () => new Date("2026-01-01T00:00:00Z") });
  const call = async (routeKey: string, opts: { headers?: Record<string, string>; body?: string; id?: string } = {}) => {
    const r = (await api({
      routeKey,
      rawPath: "/",
      headers: opts.headers ?? {},
      body: opts.body,
      pathParameters: opts.id ? { id: opts.id } : undefined,
      isBase64Encoded: false,
    } as unknown as APIGatewayProxyEventV2)) as { statusCode: number; headers: Record<string, string>; body: string };
    return { status: r.statusCode, headers: r.headers, json: JSON.parse(r.body) };
  };
  return { store, publisher, logs, call };
}

const good = JSON.stringify({ customerId: "c-1", items: [{ sku: "A1", qty: 2, priceCents: 500 }, { sku: "B2", qty: 1, priceCents: 1250 }] });
const key = { "idempotency-key": "k-1" };

test("health", async () => {
  const { call } = setup();
  assert.equal((await call("GET /health")).status, 200);
});

test("create order: 201, total computed, message published, location set", async () => {
  const { call, publisher } = setup();
  const r = await call("POST /orders", { headers: key, body: good });
  assert.equal(r.status, 201);
  assert.equal(r.json.totalCents, 2250);
  assert.equal(r.json.status, "received");
  assert.equal(r.headers.location, `/orders/${r.json.id}`);
  assert.deepEqual(publisher.messages, [{ orderId: r.json.id }]);
});

test("same Idempotency-Key returns the same order and does not publish twice", async () => {
  const { call, publisher } = setup();
  const a = await call("POST /orders", { headers: key, body: good });
  const b = await call("POST /orders", { headers: key, body: good });
  assert.equal(b.status, 200);
  assert.equal(b.json.id, a.json.id);
  assert.equal(publisher.messages.length, 1);
});

test("different keys make different orders", async () => {
  const { call } = setup();
  const a = await call("POST /orders", { headers: key, body: good });
  const b = await call("POST /orders", { headers: { "idempotency-key": "k-2" }, body: good });
  assert.notEqual(a.json.id, b.json.id);
  assert.equal(await orderIdFor("k-1"), a.json.id);
});

test("missing Idempotency-Key is 400", async () => {
  const { call } = setup();
  assert.equal((await call("POST /orders", { body: good })).status, 400);
});

test("bad JSON is 400, bad fields are 422 with details", async () => {
  const { call } = setup();
  assert.equal((await call("POST /orders", { headers: key, body: "{nope" })).status, 400);
  const r = await call("POST /orders", { headers: key, body: JSON.stringify({ customerId: "", items: [{ sku: "!", qty: 0, priceCents: -1 }] }) });
  assert.equal(r.status, 422);
  assert.equal(r.json.details.length, 4);
});

test("oversized body is 413", async () => {
  const { call } = setup();
  assert.equal((await call("POST /orders", { headers: key, body: "x".repeat(70_000) })).status, 413);
});

test("get order: 200, 404, 400 for a malformed id", async () => {
  const { call } = setup();
  const made = await call("POST /orders", { headers: key, body: good });
  assert.equal((await call("GET /orders/{id}", { id: made.json.id })).status, 200);
  assert.equal((await call("GET /orders/{id}", { id: "ord_" + "0".repeat(24) })).status, 404);
  assert.equal((await call("GET /orders/{id}", { id: "../etc/passwd" })).status, 400);
});

test("unknown route is 404; a store failure is a 500 that leaks no details", async () => {
  const s = setup();
  assert.equal((await s.call("DELETE /orders")).status, 404);
  s.store.create = async () => {
    throw new Error("secret table name xyz");
  };
  const r = await s.call("POST /orders", { headers: key, body: good });
  assert.equal(r.status, 500);
  assert.ok(!JSON.stringify(r.json).includes("xyz"));
  assert.ok(s.logs.some((l) => l.level === "error"));
});
