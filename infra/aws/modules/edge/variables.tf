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
variable "auth_rate_limit_per_five_minutes" {
  type    = number
  default = 300
}
variable "flutterwave_webhook_rate_limit_per_five_minutes" {
  type    = number
  default = 600
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
variable "payments_security_group_id" {
  description = "go-money's egress-restricted task security group, admitted by its own dedicated rule; null when unused."
  type        = string
  default     = null
}
