import { createApi } from "../src/api.ts";
import { MemoryPublisher, MemoryStore } from "../src/memory.ts";

// Measures the handler in-process with in-memory dependencies: validation, hashing,
// JSON and routing cost. It does not include API Gateway, DynamoDB or network time.
const api = createApi({ store: new MemoryStore(), publisher: new MemoryPublisher(), log: () => {}, now: () => new Date() });
const body = JSON.stringify({ customerId: "c-1", items: [{ sku: "A1", qty: 2, priceCents: 500 }] });
const N = 50_000;
const times: number[] = [];
const start = performance.now();
for (let i = 0; i < N; i++) {
  const t = performance.now();
  await api({ routeKey: "POST /orders", rawPath: "/orders", headers: { "idempotency-key": "k" + i }, body, isBase64Encoded: false } as never);
  times.push(performance.now() - t);
}
const total = performance.now() - start;
times.sort((a, b) => a - b);
const q = (p: number) => times[Math.min(N - 1, Math.floor(N * p))]!.toFixed(3);
console.log(JSON.stringify({ requests: N, perSecond: Math.round(N / (total / 1000)), p50Ms: q(0.5), p99Ms: q(0.99), node: process.version }));
