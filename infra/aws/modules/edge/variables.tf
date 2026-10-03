variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "certificate_arn" { type = string }
variable "logs_bucket_id" { type = string }
variable "logs_kms_key_arn" { type = string }
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "paystack_webhook_ips" {
  type    = list(string)
  default = ["52.31.139.75", "52.49.173.169", "52.214.14.220"]
}
variable "auth_rate_limit_per_five_minutes" {
  type    = number
  default = 300
}
variable "global_rate_limit_per_five_minutes" {
  type    = number
  default = 6000
}
variable "log_retention_days" {
  type    = number
  default = 90
}
variable "private_subnet_ids" { type = list(string) }
variable "tasks_security_group_id" { type = string }
variable "internal_service_names" { type = list(string) }
