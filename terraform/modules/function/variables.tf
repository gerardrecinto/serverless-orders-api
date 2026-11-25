variable "name" {
  type = string
}

variable "handler" {
  type = string
}

variable "zip_path" {
  type = string
}

variable "zip_hash" {
  type = string
}

variable "environment" {
  type    = map(string)
  default = {}
}

variable "permissions" {
  description = "Least-privilege statements, keyed by statement id. No wildcard actions."
  type = map(object({
    actions   = list(string)
    resources = list(string)
  }))
}

variable "memory_mb" {
  type    = number
  default = 256
}

variable "timeout_seconds" {
  type    = number
  default = 10
}

variable "reserved_concurrency" {
  type        = number
  default     = -1
  description = "-1 means unreserved. Set a cap to protect downstream services."
}

variable "log_retention_days" {
  type    = number
  default = 30
}
