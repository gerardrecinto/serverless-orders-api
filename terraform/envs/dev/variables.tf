variable "region" {
  type    = string
  default = "us-west-2"
}

variable "name" {
  type    = string
  default = "orders"
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "deletion_protection" {
  type    = bool
  default = false
}
