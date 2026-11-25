output "table_name" {
  value = aws_dynamodb_table.orders.name
}

output "table_arn" {
  value = aws_dynamodb_table.orders.arn
}

output "queue_url" {
  value = aws_sqs_queue.orders.url
}

output "queue_arn" {
  value = aws_sqs_queue.orders.arn
}

output "dlq_name" {
  value = aws_sqs_queue.dlq.name
}

output "queue_name" {
  value = aws_sqs_queue.orders.name
}
