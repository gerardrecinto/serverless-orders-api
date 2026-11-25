# Runbook

## Deploy

1. Create an S3 bucket and a DynamoDB table (key `LockID`) for Terraform state.
2. Create an IAM role that trusts `repo:gerardrecinto/serverless-orders-api` through GitHub OIDC.
3. Set repository variables: `AWS_ROLE_ARN`, `AWS_REGION`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE`.
4. Run the Deploy workflow with `apply` off, read the plan, then run it again with `apply` on.

By hand:

```
npm ci && npm run build
cd terraform/envs/dev
terraform init -backend-config="bucket=..." -backend-config="key=orders/dev.tfstate" -backend-config="region=us-west-2" -backend-config="dynamodb_table=..."
terraform apply
```

## Roll back

Both functions run from one zip. Check out the previous commit, run `npm run build`, run `terraform apply`. The table and queue are not touched by a code rollback.

## Alarms and first moves

| Alarm | Meaning | First move |
|---|---|---|
| `orders-api-5xx` | Customers get server errors | Find the request id in the API access log, search the `orders-api` log group for it |
| `orders-api-p99-latency` | p99 above 1 s for 5 min | Check DynamoDB throttles and Lambda duration in the dashboard |
| `*-errors` | A function threw | Search its log group for `level":"error"` |
| `orders-dlq-not-empty` | A message failed 5 times | Read it in the dead-letter queue, fix the cause, start a redrive to the main queue |
| `orders-queue-age` | Oldest message over 5 min | Worker is stuck or throttled; check its concurrency cap of 5 |

## Recover data

Point-in-time recovery is on. Restore the table to a new name, compare, then swap `TABLE_NAME` and apply. Orders are idempotent by key, so replaying a message cannot double-process an order.
