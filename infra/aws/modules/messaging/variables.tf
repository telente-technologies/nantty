variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "tasks_security_group_id" { type = string }
variable "data_kms_key_arn" { type = string }
variable "secrets_kms_key_arn" { type = string }
variable "deployment_mode" {
  description = "CLUSTER_MULTI_AZ (3 brokers, prod) or SINGLE_INSTANCE (dev, staging)."
  type        = string
  default     = "CLUSTER_MULTI_AZ"
  validation {
    condition     = contains(["CLUSTER_MULTI_AZ", "SINGLE_INSTANCE"], var.deployment_mode)
    error_message = "deployment_mode must be CLUSTER_MULTI_AZ or SINGLE_INSTANCE."
  }
}
variable "instance_type" {
  type    = string
  default = "mq.m7g.large"
}
variable "engine_version" {
  type    = string
  default = "3.13"
}
variable "service_users" {
  description = "One RabbitMQ user per service, created through the management API at deploy time."
  type        = list(string)
}
