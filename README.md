# serverless-orders-api

An orders API on AWS in Node.js and TypeScript: API Gateway and Lambda take the request, DynamoDB stores it, SQS hands it to a worker, Terraform builds it, and CI checks it.

Live page with the real handler running in the browser: https://gerardrecinto.github.io/serverless-orders-api/

## Run it

Needs Node 22.18 or newer.

```
git clone https://github.com/gerardrecinto/serverless-orders-api && cd serverless-orders-api
npm install
npm run dev
```

In a second terminal:

```
curl -i -X POST localhost:3000/orders -H 'Idempotency-Key: demo-1' \
  -d '{"customerId":"c-1","items":[{"sku":"A1","qty":2,"priceCents":500}]}'
```

The first call returns 201. The same call again returns 200 with the same order and queues nothing new. `GET /orders/{id}` shows the status move from `received` to `processed` after the worker runs.

## Routes

| Route | Result |
|---|---|
| `GET /health` | 200 |
| `POST /orders` | 201 new, 200 same key again, 400 no key or bad JSON, 413 over 64 KB, 422 field errors |
| `GET /orders/{id}` | 200, 404, 400 for a malformed id |

## Design

- **Idempotency.** The order id is a hash of the `Idempotency-Key`, and the write is conditional (`attribute_not_exists`). A retried request cannot create a second order or publish a second message.
- **Worker.** Handles each SQS message on its own and returns `batchItemFailures`, so one bad message does not retry the other nine. After five failures a message lands in the dead-letter queue, which has an alarm.
- **Dependencies are injected**, so the same handler runs on Lambda (DynamoDB and SQS), in `npm run dev` and in the browser demo (in memory).
- **One bundle, two functions.** esbuild produces `dist/lambda.js`; handlers are `lambda.api` and `lambda.worker`.

Trade-off: Lambda with DynamoDB suits spiky traffic and costs nothing idle. At steady high volume, containers on ECS or EKS cost less per request; the handler logic would move over unchanged.

## Terraform

| Module | Builds |
|---|---|
| `data` | DynamoDB table (on-demand, point-in-time recovery, encrypted), SQS queue and dead-letter queue (encrypted) |
| `function` | Lambda (arm64, Node 22, X-Ray, JSON logs), its log group with retention, a role with only the actions it needs |
| `api` | HTTP API, routes, `$default` stage with throttling and JSON access logs |
| `alarms` | SNS topic, alarms for 5xx, p99 latency, function errors, dead-letter queue and queue age |

`terraform/envs/dev` wires them together with S3 remote state.

## Checks

```
npm run typecheck && npm test && npm run build
```

16 tests cover the API, the worker and the Terraform (no wildcard IAM actions, retention, tracing, point-in-time recovery, dead-letter queue, throttling). CI also runs `terraform fmt`, `terraform validate` and a Trivy scan. Deploy is a manual workflow that signs in with GitHub OIDC; see [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Not covered

- It has not been applied to a live AWS account. CI validates the Terraform; `apply` needs your account and the state bucket from the runbook.
- No authentication on the routes. Put an authorizer (JWT or IAM) on the API before real traffic.
- Dev environment only.

## License

MIT
