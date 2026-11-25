variable "name" {
  type = string
}

variable "api_id" {
  type = string
}

variable "function_names" {
  type = list(string)
}

variable "queue_name" {
  type = string
}

variable "dlq_name" {
  type = string
}

variable "alert_email" {
  type    = string
  default = ""
}
