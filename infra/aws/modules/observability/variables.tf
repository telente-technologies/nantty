variable "environment" { type = string }
variable "region" { type = string }
variable "sns_kms_key_id" { type = string }
variable "alarm_email" {
  type    = string
  default = ""
}
variable "cluster_name" { type = string }
variable "service_names" { type = list(string) }
variable "alb_arn_suffix" { type = string }
variable "target_group_arn_suffixes" {
  type = map(object({
    load_balancer_suffix = string
    target_group_suffix  = string
  }))
}
variable "p99_latency_seconds" {
  type    = number
  default = 1.5
}
variable "aurora_cluster_identifier" { type = string }
variable "aurora_connection_threshold" {
  type    = number
  default = 1500
}
variable "valkey_replication_group_id" { type = string }
variable "mq_broker_name" { type = string }
variable "mq_memory_threshold_bytes" {
  type    = number
  default = 6000000000
}
variable "mq_backlog_threshold" {
  type    = number
  default = 10000
}
variable "ses_feedback_dlq_name" { type = string }
