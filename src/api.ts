import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { Deps, Order } from "./types.ts";
import { parseNewOrder } from "./validate.ts";

const MAX_BODY_BYTES = 64 * 1024;

function json(statusCode: number, body: unknown, extra: Record<string, string> = {}): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
    body: JSON.stringify(body),
  };
}

/** Same key from the same caller always maps to the same order id. */
export async function orderIdFor(idempotencyKey: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(idempotencyKey));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return "ord_" + hex.slice(0, 24);
}

export function createApi(deps: Deps) {
  return async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const requestId = event.requestContext?.requestId ?? globalThis.crypto.randomUUID();
    const started = Date.now();
    const route = event.routeKey ?? `${event.requestContext?.http?.method} ${event.rawPath}`;
    let res: APIGatewayProxyResultV2;
    try {
      res = await dispatch(route, event, deps);
    } catch (err) {
      deps.log({ level: "error", requestId, route, error: String(err) });
      res = json(500, { error: "internal error", requestId });
    }
    const status = typeof res === "string" ? 200 : (res.statusCode ?? 200);
    deps.log({ level: "info", requestId, route, status, ms: Date.now() - started });
    return res;
  };
}

async function dispatch(route: string, event: APIGatewayProxyEventV2, deps: Deps): Promise<APIGatewayProxyResultV2> {
  if (route === "GET /health") return json(200, { status: "ok" });

  if (route === "POST /orders") {
    const key = event.headers?.["idempotency-key"]?.trim();
    if (!key || key.length > 128) return json(400, { error: "Idempotency-Key header is required (max 128 characters)" });

    const raw = event.isBase64Encoded ? new TextDecoder().decode(Uint8Array.from(atob(event.body ?? ""), (c) => c.charCodeAt(0))) : (event.body ?? "");
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, { error: "body too large" });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json(400, { error: "body is not valid JSON" });
    }
    const v = parseNewOrder(parsed);
    if (!v.ok) return json(422, { error: "validation failed", details: v.errors });

    const order: Order = {
      id: await orderIdFor(key),
      customerId: v.value.customerId,
      items: v.value.items,
      totalCents: v.value.items.reduce((sum, i) => sum + i.qty * i.priceCents, 0),
      status: "received",
      createdAt: deps.now().toISOString(),
    };
    const { order: stored, created } = await deps.store.create(order);
    if (created) await deps.publisher.publish({ orderId: stored.id });
    return json(created ? 201 : 200, stored, { location: `/orders/${stored.id}` });
  }

  if (route === "GET /orders/{id}") {
    const id = event.pathParameters?.id ?? "";
    if (!/^ord_[0-9a-f]{24}$/.test(id)) return json(400, { error: "invalid order id" });
    const found = await deps.store.get(id);
    return found ? json(200, found) : json(404, { error: "order not found" });
  }

  return json(404, { error: "no such route" });
}
