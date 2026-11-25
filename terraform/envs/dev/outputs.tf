output "api_url" {
  value = module.api.url
}

output "table_name" {
  value = module.data.table_name
}

output "alerts_topic_arn" {
  value = module.alarms.topic_arn
}
