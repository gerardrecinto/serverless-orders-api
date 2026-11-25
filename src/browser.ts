import { createApi } from "./api.ts";
import { MemoryPublisher, MemoryStore } from "./memory.ts";
import { createWorker } from "./worker.ts";

const store = new MemoryStore();
const publisher = new MemoryPublisher();
const logs: string[] = [];
const deps = { store, publisher, log: (f: Record<string, unknown>) => logs.push(JSON.stringify(f)), now: () => new Date() };
const api = createApi(deps);
const worker = createWorker(deps);

(globalThis as Record<string, unknown>).demo = {
  async call(routeKey: string, headers: Record<string, string>, body: string, id?: string) {
    const r = (await api({ routeKey, rawPath: "/", headers, body, pathParameters: id ? { id } : undefined, isBase64Encoded: false } as never)) as {
      statusCode: number;
      body: string;
    };
    return { status: r.statusCode, body: r.body };
  },
  queued: () => publisher.messages.length,
  async drain() {
    const n = publisher.messages.length;
    while (publisher.messages.length) {
      const m = publisher.messages.shift()!;
      await worker({ Records: [{ messageId: "demo", body: JSON.stringify(m) }] } as never);
    }
    return n;
  },
  logs: () => logs.splice(0),
};
