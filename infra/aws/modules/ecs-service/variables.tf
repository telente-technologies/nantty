variable "name" { type = string }
variable "environment" { type = string }
variable "region" { type = string }
variable "cluster_arn" { type = string }
variable "cluster_name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "image" { type = string }
variable "image_tag" { type = string }
variable "cpu" { type = number }
variable "memory" { type = number }
variable "port" { type = number }
variable "extra_ports" {
  type    = list(number)
  default = []
}
variable "health_path" { type = string }
variable "environment_variables" {
  type    = map(string)
  default = {}
}
variable "secrets" {
  description = "Container env name to Secrets Manager valueFrom."
  type        = map(string)
  default     = {}
}
variable "secret_arns" {
  description = "Secrets the execution role may read."
  type        = list(string)
  default     = []
}
variable "secrets_kms_key_arn" { type = string }
variable "logs_kms_key_arn" { type = string }
variable "task_policy_statements" {
  description = "Least-privilege statements for the task role."
  type = list(object({
    sid       = string
    actions   = list(string)
    resources = list(string)
  }))
  default = []
}
variable "desired_count" {
  type    = number
  default = 0
}
variable "min_count" {
  type    = number
  default = 2
}
variable "max_count" {
  type    = number
  default = 6
}
variable "cpu_target_percent" {
  type    = number
  default = 60
}
variable "memory_target_percent" {
  type    = number
  default = 75
}
variable "request_count_target" {
  description = "ALB requests per target per minute for step scaling, 0 disables."
  type        = number
  default     = 0
}
variable "alb_arn_suffix" {
  type    = string
  default = null
}
variable "listener_rules" {
  type = list(object({
    listener_arn  = string
    priority      = number
    path_patterns = optional(list(string), [])
    host_headers  = optional(list(string), [])
  }))
  default = []
}
variable "deregistration_delay" {
  type    = number
  default = 30
}
variable "namespace_id" { type = string }
variable "blue_green" {
  description = "CodeDeploy blue/green with a 10 percent canary instead of ECS rolling."
  type        = bool
  default     = false
}
variable "blue_green_listener_arn" {
  type    = string
  default = null
}
variable "blue_green_alarm_names" {
  type    = list(string)
  default = []
}
variable "codedeploy_config" {
  type    = string
  default = "CodeDeployDefault.ECSCanary10Percent5Minutes"
}
variable "container_health_check" {
  description = "Container health check command, null when the image has no shell (distroless)."
  type        = list(string)
  default     = null
}
variable "readonly_root_filesystem" {
  type    = bool
  default = true
}
variable "enable_execute_command" {
  type    = bool
  default = false
}
variable "otel_sidecar" {
  type    = bool
  default = true
}
variable "log_retention_days" {
  type    = number
  default = 90
}
variable "use_spot" {
  type    = bool
  default = false
}
variable "cpu_architecture" {
  type    = string
  default = "ARM64"
}
variable "otel_collector_image" {
  type    = string
  default = "public.ecr.aws/aws-observability/aws-otel-collector:v0.41.1"
}
