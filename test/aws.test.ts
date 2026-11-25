import assert from "node:assert/strict";
import { test } from "node:test";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoStore, SqsPublisher } from "../src/aws.ts";

const order = { id: "ord_" + "a".repeat(24), customerId: "c", items: [], totalCents: 0, status: "received" as const, createdAt: "x" };
const conflict = () => new ConditionalCheckFailedException({ message: "exists", $metadata: {} });

function fake(handler: (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => unknown) {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  const doc = {
    send: async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
      calls.push({ name: cmd.constructor.name, input: cmd.input });
      return handler(cmd);
    },
  } as unknown as DynamoDBDocumentClient;
  return { doc, calls };
}

test("create writes with a not-exists condition", async () => {
  const { doc, calls } = fake(() => ({}));
  const r = await new DynamoStore(doc, "t").create(order);
  assert.equal(r.created, true);
  assert.equal(calls[0]!.input.ConditionExpression, "attribute_not_exists(id)");
});

test("a conflict returns the stored order instead of failing", async () => {
  const stored = { ...order, status: "processed" };
  const { doc } = fake((c) => {
    if (c.constructor.name === "PutCommand") throw conflict();
    return { Item: stored };
  });
  const r = await new DynamoStore(doc, "t").create(order);
  assert.deepEqual(r, { order: stored, created: false });
});

test("other errors are not swallowed", async () => {
  const { doc } = fake(() => {
    throw new Error("throttled");
  });
  await assert.rejects(new DynamoStore(doc, "t").create(order), /throttled/);
});

test("reads are consistent and markProcessed only touches an existing item", async () => {
  const { doc, calls } = fake(() => ({}));
  const s = new DynamoStore(doc, "t");
  await s.get(order.id);
  await s.markProcessed(order.id);
  assert.equal(calls[0]!.input.ConsistentRead, true);
  assert.equal(calls[1]!.input.ConditionExpression, "attribute_exists(id)");
});

test("publisher sends the order id as JSON to the queue", async () => {
  const sent: Record<string, unknown>[] = [];
  const sqs = { send: async (c: { input: Record<string, unknown> }) => sent.push(c.input) } as unknown as SQSClient;
  await new SqsPublisher(sqs, "https://q").publish({ orderId: "o" });
  assert.deepEqual(sent[0], { QueueUrl: "https://q", MessageBody: '{"orderId":"o"}' });
});
