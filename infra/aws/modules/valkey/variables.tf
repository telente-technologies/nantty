variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "data_subnet_ids" { type = list(string) }
variable "client_security_group_ids" {
  description = "Security groups allowed to reach Valkey on 6379."
  type        = list(string)
}
variable "name_suffix" {
  description = "Appended to resource names, for example -intelligence; empty for the shared cluster."
  type        = string
  default     = ""
}
variable "description" {
  type    = string
  default = "nantty cache, rate limits, idempotency, presence"
}
variable "maxmemory_policy" {
  type    = string
  default = "volatile-lru"
}
variable "logical_database" {
  description = "Database number in the URL secret."
  type        = number
  default     = 0
}
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
variable "payments_security_group_id" {
  description = "go-money's egress-restricted task security group, admitted by its own dedicated rule; null when unused."
  type        = string
  default     = null
}
