terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

locals {
  name = "nantty-${var.environment}${var.name_suffix}"
}

resource "aws_elasticache_subnet_group" "this" {
  name       = local.name
  subnet_ids = var.data_subnet_ids
}

resource "aws_security_group" "valkey" {
  name_prefix = "${local.name}-valkey-"
  description = "Valkey, reachable from the listed client security groups only"
  vpc_id      = var.vpc_id
  ingress {
    description     = "Valkey TLS from client tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.client_security_group_ids
  }
  dynamic "ingress" {
    for_each = var.payments_security_group_id == null ? [] : [var.payments_security_group_id]
    content {
      description     = "Valkey TLS from go-money (payments)"
      from_port       = 6379
      to_port         = 6379
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }
  lifecycle { create_before_destroy = true }
}

resource "random_password" "auth" {
  length  = 48
  special = false
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${local.name}-valkey8"
  family = "valkey8"
  parameter {
    name  = "maxmemory-policy"
    value = var.maxmemory_policy
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = local.name
  description                = var.description
  engine                     = "valkey"
  engine_version             = var.engine_version
  node_type                  = var.node_type
  num_cache_clusters         = var.node_count
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.this.name
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.valkey.id]
  automatic_failover_enabled = var.node_count > 1
  multi_az_enabled           = var.node_count > 1
  at_rest_encryption_enabled = true
  kms_key_id                 = var.data_kms_key_arn
  transit_encryption_enabled = true
  auth_token                 = random_password.auth.result
  auth_token_update_strategy = "ROTATE"
  snapshot_retention_limit   = var.snapshot_retention_days
  snapshot_window            = "01:00-02:00"
  maintenance_window         = "sun:05:00-sun:06:00"
  apply_immediately          = false
  auto_minor_version_upgrade = true
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}

resource "aws_cloudwatch_log_group" "slow" {
  name              = "/nantty/${var.environment}/valkey${var.name_suffix}-slow"
  retention_in_days = 30
  kms_key_id        = var.logs_kms_key_arn
}

resource "aws_secretsmanager_secret" "url" {
  name       = "nantty/${var.environment}/valkey${var.name_suffix}/url"
  kms_key_id = var.secrets_kms_key_arn
}

resource "aws_secretsmanager_secret_version" "url" {
  secret_id     = aws_secretsmanager_secret.url.id
  secret_string = "rediss://:${random_password.auth.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379/${var.logical_database}"
}
