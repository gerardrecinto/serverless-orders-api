import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { Order, Publisher, Store } from "./types.ts";

export class DynamoStore implements Store {
  private readonly doc: DynamoDBDocumentClient;
  private readonly table: string;
  constructor(doc: DynamoDBDocumentClient, table: string) {
    this.doc = doc;
    this.table = table;
  }

  async create(order: Order) {
    try {
      await this.doc.send(
        new PutCommand({ TableName: this.table, Item: order, ConditionExpression: "attribute_not_exists(id)" }),
      );
      return { order, created: true };
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
      const existing = await this.get(order.id);
      if (!existing) throw err;
      return { order: existing, created: false };
    }
  }

  async get(id: string) {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: { id }, ConsistentRead: true }));
    return r.Item as Order | undefined;
  }

  async markProcessed(id: string) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { id },
        UpdateExpression: "SET #s = :p",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":p": "processed" },
      }),
    );
  }
}

export class SqsPublisher implements Publisher {
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  constructor(sqs: SQSClient, queueUrl: string) {
    this.sqs = sqs;
    this.queueUrl = queueUrl;
  }
  async publish(message: { orderId: string }) {
    await this.sqs.send(new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(message) }));
  }
}

export function awsDeps(env: NodeJS.ProcessEnv) {
  const table = env.TABLE_NAME;
  const queueUrl = env.QUEUE_URL;
  if (!table || !queueUrl) throw new Error("TABLE_NAME and QUEUE_URL must be set");
  return {
    store: new DynamoStore(DynamoDBDocumentClient.from(new DynamoDBClient({})), table),
    publisher: new SqsPublisher(new SQSClient({}), queueUrl),
    log: (f: Record<string, unknown>) => console.log(JSON.stringify(f)),
    now: () => new Date(),
  };
}
