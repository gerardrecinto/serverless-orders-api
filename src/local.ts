import { createServer } from "node:http";
import { createApi } from "./api.ts";
import { MemoryPublisher, MemoryStore } from "./memory.ts";
import { createWorker } from "./worker.ts";

const store = new MemoryStore();
const publisher = new MemoryPublisher();
const deps = { store, publisher, log: (f: Record<string, unknown>) => console.log(JSON.stringify(f)), now: () => new Date() };
const api = createApi(deps);
const worker = createWorker(deps);

const routes: [string, RegExp, string][] = [
  ["GET", /^\/health$/, "GET /health"],
  ["POST", /^\/orders$/, "POST /orders"],
  ["GET", /^\/orders\/([^/]+)$/, "GET /orders/{id}"],
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const hit = routes.map(([m, re, key]) => ({ m, m2: re.exec(url.pathname), key })).find((r) => r.m === req.method && r.m2);
  const out = (await api({
    routeKey: hit?.key ?? "$default",
    rawPath: url.pathname,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
    pathParameters: hit?.m2?.[1] ? { id: hit.m2[1] } : undefined,
    body: Buffer.concat(chunks).toString("utf8"),
    isBase64Encoded: false,
  } as never)) as { statusCode: number; headers: Record<string, string>; body: string };
  // Stand in for SQS: deliver queued messages to the worker right away.
  while (publisher.messages.length) {
    const m = publisher.messages.shift()!;
    await worker({ Records: [{ messageId: "local", body: JSON.stringify(m) }] } as never);
  }
  res.writeHead(out.statusCode, out.headers).end(out.body);
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(JSON.stringify({ level: "info", msg: `listening on http://localhost:${port}` })));
