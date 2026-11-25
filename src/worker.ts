import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { Deps } from "./types.ts";

/** Handles each message on its own so one bad message does not retry the whole batch. */
export function createWorker(deps: Pick<Deps, "store" | "log">) {
  return async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
    const batchItemFailures: { itemIdentifier: string }[] = [];
    for (const record of event.Records) {
      try {
        const { orderId } = JSON.parse(record.body) as { orderId?: string };
        if (!orderId) throw new Error("message has no orderId");
        const order = await deps.store.get(orderId);
        if (!order) throw new Error(`order ${orderId} not found`);
        await deps.store.markProcessed(orderId);
        deps.log({ level: "info", messageId: record.messageId, orderId, result: "processed" });
      } catch (err) {
        deps.log({ level: "error", messageId: record.messageId, error: String(err) });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    return { batchItemFailures };
  };
}
