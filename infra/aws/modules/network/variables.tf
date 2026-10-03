variable "environment" { type = string }
variable "vpc_cidr" { type = string }
variable "az_count" {
  type    = number
  default = 3
}
variable "nat_per_az" {
  description = "One NAT gateway per AZ (prod) or a single shared one (dev, staging)."
  type        = bool
  default     = false
}
variable "flow_log_bucket_arn" { type = string }
variable "interface_endpoint_services" {
  description = "Interface endpoints that keep AWS API traffic off the NAT gateways."
  type        = list(string)
  default = [
    "ecr.api", "ecr.dkr", "logs", "secretsmanager", "kms", "sqs", "sts", "monitoring", "ssm", "ssmmessages", "ec2messages", "xray", "elasticloadbalancing", "ecs", "ecs-agent", "ecs-telemetry", "rds", "sns",
  ]
}
