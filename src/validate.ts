import type { OrderItem } from "./types.ts";

export type NewOrder = { customerId: string; items: OrderItem[] };

const SKU = /^[A-Za-z0-9_-]{1,40}$/;

export function parseNewOrder(body: unknown): { ok: true; value: NewOrder } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.customerId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(b.customerId)) {
    errors.push("customerId must be 1 to 64 letters, digits, - or _");
  }
  const items: OrderItem[] = [];
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 50) {
    errors.push("items must be an array of 1 to 50 entries");
  } else {
    b.items.forEach((raw, i) => {
      const it = raw as Record<string, unknown> | null;
      const okSku = typeof it?.sku === "string" && SKU.test(it.sku);
      const okQty = Number.isInteger(it?.qty) && (it?.qty as number) >= 1 && (it?.qty as number) <= 1000;
      const okPrice = Number.isInteger(it?.priceCents) && (it?.priceCents as number) >= 0 && (it?.priceCents as number) <= 100_000_000;
      if (!okSku) errors.push(`items[${i}].sku is invalid`);
      if (!okQty) errors.push(`items[${i}].qty must be an integer from 1 to 1000`);
      if (!okPrice) errors.push(`items[${i}].priceCents must be a non-negative integer`);
      if (okSku && okQty && okPrice) items.push({ sku: it!.sku as string, qty: it!.qty as number, priceCents: it!.priceCents as number });
    });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { customerId: b.customerId as string, items } };
}
