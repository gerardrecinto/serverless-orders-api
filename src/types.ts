export type OrderItem = { sku: string; qty: number; priceCents: number };

export type Order = {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalCents: number;
  status: "received" | "processed";
  createdAt: string;
};

export interface Store {
  /** Insert if the id is new. Returns the stored order and whether this call created it. */
  create(order: Order): Promise<{ order: Order; created: boolean }>;
  get(id: string): Promise<Order | undefined>;
  /** received -> processed. Safe to call twice. */
  markProcessed(id: string): Promise<void>;
}

export interface Publisher {
  publish(message: { orderId: string }): Promise<void>;
}

export type Logger = (fields: Record<string, unknown>) => void;

export type Deps = {
  store: Store;
  publisher: Publisher;
  log: Logger;
  now: () => Date;
};
