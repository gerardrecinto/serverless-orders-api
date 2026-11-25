variable "name" {
  type = string
}

variable "function_name" {
  type = string
}

variable "function_invoke_arn" {
  type = string
}

variable "routes" {
  type = list(string)
}

variable "rate_limit" {
  type    = number
  default = 50
}

variable "burst_limit" {
  type    = number
  default = 100
}

variable "log_retention_days" {
  type    = number
  default = 30
}
