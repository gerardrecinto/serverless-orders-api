locals {
  worker_timeout = 30
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../../../dist/lambda.js"
  output_path = "${path.module}/.build/lambda.zip"
}

module "data" {
  source                     = "../../modules/data"
  name                       = var.name
  visibility_timeout_seconds = local.worker_timeout * 6
  deletion_protection        = var.deletion_protection
}

module "api_function" {
  source   = "../../modules/function"
  name     = "${var.name}-api"
  handler  = "lambda.api"
  zip_path = data.archive_file.lambda.output_path
  zip_hash = data.archive_file.lambda.output_base64sha256

  environment = {
    TABLE_NAME = module.data.table_name
    QUEUE_URL  = module.data.queue_url
  }

  permissions = {
    OrdersTableReadWrite = {
      actions   = ["dynamodb:GetItem", "dynamodb:PutItem"]
      resources = [module.data.table_arn]
    }
    PublishOrders = {
      actions   = ["sqs:SendMessage"]
      resources = [module.data.queue_arn]
    }
  }
}

module "worker_function" {
  source          = "../../modules/function"
  name            = "${var.name}-worker"
  handler         = "lambda.worker"
  zip_path        = data.archive_file.lambda.output_path
  zip_hash        = data.archive_file.lambda.output_base64sha256
  timeout_seconds = local.worker_timeout

  environment = {
    TABLE_NAME = module.data.table_name
    QUEUE_URL  = module.data.queue_url
  }

  permissions = {
    OrdersTableReadUpdate = {
      actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
      resources = [module.data.table_arn]
    }
    ConsumeOrders = {
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      resources = [module.data.queue_arn]
    }
  }
}

resource "aws_lambda_event_source_mapping" "worker" {
  event_source_arn        = module.data.queue_arn
  function_name           = module.worker_function.arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 5
  }
}

module "api" {
  source              = "../../modules/api"
  name                = var.name
  function_name       = module.api_function.name
  function_invoke_arn = module.api_function.invoke_arn
  routes              = ["GET /health", "POST /orders", "GET /orders/{id}"]
}

module "alarms" {
  source         = "../../modules/alarms"
  name           = var.name
  api_id         = module.api.api_id
  function_names = [module.api_function.name, module.worker_function.name]
  queue_name     = module.data.queue_name
  dlq_name       = module.data.dlq_name
  alert_email    = var.alert_email
}
