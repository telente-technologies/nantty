variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "certificate_arn" { type = string }
variable "logs_bucket_id" { type = string }
variable "logs_kms_key_arn" { type = string }
variable "cloudflare_ipv4_cidrs" { type = list(string) }
variable "cloudflare_ipv6_cidrs" { type = list(string) }
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
