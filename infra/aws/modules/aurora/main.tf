terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70", configuration_aliases = [aws.dr] }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

locals {
  name = "zudomart-${var.environment}"
}

resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = var.data_subnet_ids
}

resource "aws_security_group" "database" {
  name_prefix = "${local.name}-aurora-"
  description = "Aurora and RDS Proxy, reachable from ECS tasks only"
  vpc_id      = var.vpc_id
  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.tasks_security_group_id]
  }
  dynamic "ingress" {
    for_each = var.payments_security_group_id == null ? [] : [var.payments_security_group_id]
    content {
      description     = "PostgreSQL from go-money (payments)"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_security_group_rule" "proxy_to_database" {
  type                     = "ingress"
  description              = "RDS Proxy to Aurora"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.database.id
  source_security_group_id = aws_security_group.database.id
}

resource "aws_rds_cluster_parameter_group" "this" {
  name_prefix = "${local.name}-pg17-"
  family      = var.parameter_group_family
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_iam_role" "monitoring" {
  name = "${local.name}-aurora-monitoring"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "monitoring.rds.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "monitoring" {
  role       = aws_iam_role.monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_rds_cluster" "this" {
  cluster_identifier                  = local.name
  engine                              = "aurora-postgresql"
  engine_version                      = var.engine_version
  database_name                       = "zudomart"
  master_username                     = "zudomart_admin"
  manage_master_user_password         = true
  master_user_secret_kms_key_id       = var.secrets_kms_key_arn
  storage_encrypted                   = true
  kms_key_id                          = var.data_kms_key_arn
  db_subnet_group_name                = aws_db_subnet_group.this.name
  vpc_security_group_ids              = [aws_security_group.database.id]
  db_cluster_parameter_group_name     = aws_rds_cluster_parameter_group.this.name
  iam_database_authentication_enabled = true
  backup_retention_period             = var.backup_retention_days
  preferred_backup_window             = "02:00-03:00"
  preferred_maintenance_window        = "sun:03:30-sun:04:30"
  copy_tags_to_snapshot               = true
  deletion_protection                 = var.deletion_protection
  skip_final_snapshot                 = false
  final_snapshot_identifier           = "${local.name}-final"
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  apply_immediately                   = false
  tags                                = { Backup = "aurora-daily" }
  lifecycle { ignore_changes = [final_snapshot_identifier] }
}

resource "aws_rds_cluster_instance" "this" {
  count                           = 1 + var.reader_count
  identifier                      = "${local.name}-${count.index == 0 ? "writer" : "reader-${count.index}"}"
  cluster_identifier              = aws_rds_cluster.this.id
  engine                          = aws_rds_cluster.this.engine
  engine_version                  = aws_rds_cluster.this.engine_version
  instance_class                  = var.instance_class
  db_subnet_group_name            = aws_db_subnet_group.this.name
  promotion_tier                  = count.index
  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.data_kms_key_arn
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.monitoring.arn
  auto_minor_version_upgrade      = true
  ca_cert_identifier              = "rds-ca-rsa2048-g1"
}

resource "random_password" "service_roles" {
  for_each = toset(var.service_database_roles)
  length   = 32
  special  = false
}

resource "aws_secretsmanager_secret" "service_roles" {
  for_each   = toset(var.service_database_roles)
  name       = "zudomart/${var.environment}/db/${each.key}"
  kms_key_id = var.secrets_kms_key_arn
}

resource "aws_secretsmanager_secret_version" "service_roles" {
  for_each  = toset(var.service_database_roles)
  secret_id = aws_secretsmanager_secret.service_roles[each.key].id
  secret_string = jsonencode({
    username   = each.key
    password   = random_password.service_roles[each.key].result
    host       = aws_db_proxy.this.endpoint
    port       = 5432
    dbname     = "zudomart"
    url        = "postgres://${each.key}:${random_password.service_roles[each.key].result}@${aws_db_proxy.this.endpoint}:5432/zudomart?sslmode=require"
    prisma_url = "postgres://${each.key}:${random_password.service_roles[each.key].result}@${aws_db_proxy.this.endpoint}:5432/zudomart?sslmode=require&schema=${replace(each.key, "svc_", "")}"
  })
  lifecycle { ignore_changes = [secret_string] }
}
