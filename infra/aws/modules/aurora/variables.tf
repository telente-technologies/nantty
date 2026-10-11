variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "data_subnet_ids" { type = list(string) }
variable "tasks_security_group_id" { type = string }
variable "data_kms_key_arn" { type = string }
variable "secrets_kms_key_arn" { type = string }
variable "backup_kms_key_arn" { type = string }
variable "dr_backup_kms_key_arn" {
  type    = string
  default = null
}
variable "engine_version" {
  type    = string
  default = "17.4"
}
variable "parameter_group_family" {
  type    = string
  default = "aurora-postgresql17"
}
variable "instance_class" {
  type    = string
  default = "db.r7g.large"
}
variable "reader_count" {
  type    = number
  default = 1
}
variable "backup_retention_days" {
  description = "Aurora PITR window, 35 days is the maximum."
  type        = number
  default     = 35
}
variable "dr_snapshot_retention_days" {
  type    = number
  default = 35
}
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "enable_dr" {
  type    = bool
  default = false
}
variable "service_database_roles" {
  description = "Runtime roles (svc_<service>) plus the migrator role; created in Postgres by the bootstrap job."
  type        = list(string)
}
variable "payments_security_group_id" {
  description = "go-money's egress-restricted task security group, admitted by its own dedicated rule; null when unused."
  type        = string
  default     = null
}
