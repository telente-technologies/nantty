variable "environment" { type = string }
variable "region" { type = string }
variable "mode" {
  description = "cloud keeps credentials for LiveKit Cloud; self_hosted runs LiveKit on EC2-backed ECS with host networking."
  type        = string
  default     = "cloud"
  validation {
    condition     = contains(["cloud", "self_hosted"], var.mode)
    error_message = "mode must be cloud or self_hosted."
  }
}
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "cluster_arn" { type = string }
variable "cluster_name" { type = string }
variable "listener_arn" { type = string }
variable "alb_security_group_id" { type = string }
variable "host" {
  description = "Signaling host name, for example livekit.staging.zudomart.com."
  type        = string
}
variable "webhook_url" {
  description = "Signed room events (room_finished, participant_left) go here; the gateway routes it to go-live."
  type        = string
}
variable "secrets_kms_key_arn" { type = string }
variable "logs_kms_key_arn" { type = string }
variable "valkey_endpoint" { type = string }
variable "valkey_auth_token" {
  type      = string
  sensitive = true
}
variable "node_count" {
  type    = number
  default = 2
}
variable "instance_type" {
  type    = string
  default = "c7g.large"
}
variable "task_cpu" {
  type    = number
  default = 1792
}
variable "task_memory" {
  type    = number
  default = 3072
}
variable "image" {
  type    = string
  default = "livekit/livekit-server:v1.8.0"
}
variable "log_retention_days" {
  type    = number
  default = 90
}
