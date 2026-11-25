import type { Order, Publisher, Store } from "./types.ts";

export class MemoryStore implements Store {
  orders = new Map<string, Order>();
  async create(order: Order) {
    const existing = this.orders.get(order.id);
    if (existing) return { order: existing, created: false };
    this.orders.set(order.id, order);
    return { order, created: true };
  }
  async get(id: string) {
    return this.orders.get(id);
  }
  async markProcessed(id: string) {
    const o = this.orders.get(id);
    if (o) o.status = "processed";
  }
}

export class MemoryPublisher implements Publisher {
  messages: { orderId: string }[] = [];
  async publish(message: { orderId: string }) {
    this.messages.push(message);
  }
}
