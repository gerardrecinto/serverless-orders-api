variable "name" {
  type = string
}

variable "visibility_timeout_seconds" {
  type        = number
  description = "Set to at least 6 times the worker timeout so a slow message is not delivered twice."
}

variable "deletion_protection" {
  type    = bool
  default = true
}
