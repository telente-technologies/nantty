variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "data_subnet_ids" { type = list(string) }
variable "tasks_security_group_id" { type = string }
variable "data_kms_key_arn" { type = string }
variable "secrets_kms_key_arn" { type = string }
variable "logs_kms_key_arn" { type = string }
variable "node_type" {
  type    = string
  default = "cache.r7g.large"
}
variable "node_count" {
  description = "Primary plus replicas; two or more gives Multi-AZ failover."
  type        = number
  default     = 2
}
variable "engine_version" {
  type    = string
  default = "8.0"
}
variable "snapshot_retention_days" {
  type    = number
  default = 3
}
