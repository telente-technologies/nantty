terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

locals {
  name       = "zudomart-${var.environment}"
  is_cluster = var.deployment_mode == "CLUSTER_MULTI_AZ"
}

resource "aws_security_group" "broker" {
  name_prefix = "${local.name}-mq-"
  description = "Amazon MQ RabbitMQ, AMQPS from ECS tasks only"
  vpc_id      = var.vpc_id
  ingress {
    description     = "AMQPS from ECS tasks"
    from_port       = 5671
    to_port         = 5671
    protocol        = "tcp"
    security_groups = [var.tasks_security_group_id]
  }
  ingress {
    description     = "Management API over HTTPS from ECS tasks (topology import on deploy)"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [var.tasks_security_group_id]
  }
  lifecycle { create_before_destroy = true }
}

resource "random_password" "admin" {
  length  = 40
  special = false
}

resource "aws_mq_broker" "this" {
  broker_name                = local.name
  engine_type                = "RabbitMQ"
  engine_version             = var.engine_version
  host_instance_type         = var.instance_type
  deployment_mode            = var.deployment_mode
  publicly_accessible        = false
  auto_minor_version_upgrade = true
  apply_immediately          = false
  subnet_ids                 = [var.private_subnet_ids[0]]
  security_groups            = [aws_security_group.broker.id]

  encryption_options {
    use_aws_owned_key = false
    kms_key_id        = var.data_kms_key_arn
  }

  logs { general = true }

  maintenance_window_start_time {
    day_of_week = "SUNDAY"
    time_of_day = "04:00"
    time_zone   = "UTC"
  }

  user {
    username = "zudomart_admin"
    password = random_password.admin.result
  }

  lifecycle { ignore_changes = [user] }
}

resource "aws_secretsmanager_secret" "admin" {
  name       = "zudomart/${var.environment}/mq/admin"
  kms_key_id = var.secrets_kms_key_arn
}

resource "aws_secretsmanager_secret_version" "admin" {
  secret_id = aws_secretsmanager_secret.admin.id
  secret_string = jsonencode({
    username       = "zudomart_admin"
    password       = random_password.admin.result
    host           = replace(replace(aws_mq_broker.this.instances[0].endpoints[0], "amqps://", ""), ":5671", "")
    management_url = aws_mq_broker.this.instances[0].console_url
  })
  lifecycle { ignore_changes = [secret_string] }
}

resource "random_password" "service_users" {
  for_each = toset(var.service_users)
  length   = 32
  special  = false
}

resource "aws_secretsmanager_secret" "service_users" {
  for_each   = toset(var.service_users)
  name       = "zudomart/${var.environment}/mq/${each.key}"
  kms_key_id = var.secrets_kms_key_arn
}

resource "aws_secretsmanager_secret_version" "service_users" {
  for_each  = toset(var.service_users)
  secret_id = aws_secretsmanager_secret.service_users[each.key].id
  secret_string = jsonencode({
    username = each.key
    password = random_password.service_users[each.key].result
    url      = "amqps://${each.key}:${random_password.service_users[each.key].result}@${replace(replace(aws_mq_broker.this.instances[0].endpoints[0], "amqps://", ""), ":5671", "")}:5671"
  })
  lifecycle { ignore_changes = [secret_string] }
}
