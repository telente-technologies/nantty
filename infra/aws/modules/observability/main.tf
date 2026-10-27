terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

locals {
  name = "nantty-${var.environment}"
}

resource "aws_sns_topic" "alarms" {
  name              = "${local.name}-alarms"
  kms_master_key_id = var.sns_kms_key_id
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "${local.name}-alb-5xx-rate"
  alarm_description   = "More than 2 percent of responses are 5xx"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 2
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  metric_query {
    id          = "rate"
    expression  = "100 * errors / MAX([errors, requests])"
    label       = "5xx percent"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }
  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "service_unhealthy_hosts" {
  for_each            = var.target_group_arn_suffixes
  alarm_name          = "${local.name}-${each.key}-unhealthy-hosts"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { LoadBalancer = each.value.load_balancer_suffix, TargetGroup = each.value.target_group_suffix }
}

resource "aws_cloudwatch_metric_alarm" "service_p99_latency" {
  for_each            = var.target_group_arn_suffixes
  alarm_name          = "${local.name}-${each.key}-p99-latency"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  period              = 60
  evaluation_periods  = 5
  datapoints_to_alarm = 3
  threshold           = var.p99_latency_seconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { LoadBalancer = each.value.load_balancer_suffix, TargetGroup = each.value.target_group_suffix }
}

resource "aws_cloudwatch_metric_alarm" "service_5xx" {
  for_each            = var.target_group_arn_suffixes
  alarm_name          = "${local.name}-${each.key}-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { LoadBalancer = each.value.load_balancer_suffix, TargetGroup = each.value.target_group_suffix }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each            = toset(var.service_names)
  alarm_name          = "${local.name}-${each.key}-cpu-high"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 10
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { ClusterName = var.cluster_name, ServiceName = each.key }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each            = toset(var.service_names)
  alarm_name          = "${local.name}-${each.key}-memory-high"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 10
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { ClusterName = var.cluster_name, ServiceName = each.key }
}

resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks" {
  for_each            = toset(var.service_names)
  alarm_name          = "${local.name}-${each.key}-no-running-tasks"
  namespace           = "ECS/ContainerInsights"
  metric_name         = "RunningTaskCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { ClusterName = var.cluster_name, ServiceName = each.key }
}

resource "aws_cloudwatch_metric_alarm" "ledger_imbalance" {
  alarm_name          = "${local.name}-ledger-imbalance"
  alarm_description   = "Trial balance is not zero; money deployments roll back on this alarm"
  namespace           = "Nantty/${var.environment}"
  metric_name         = "LedgerImbalance"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  alarm_name          = "${local.name}-aurora-cpu"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 10
  threshold           = 70
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { DBClusterIdentifier = var.aurora_cluster_identifier, Role = "WRITER" }
}

resource "aws_cloudwatch_metric_alarm" "aurora_replica_lag" {
  alarm_name          = "${local.name}-aurora-replica-lag"
  namespace           = "AWS/RDS"
  metric_name         = "AuroraReplicaLagMaximum"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 2000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { DBClusterIdentifier = var.aurora_cluster_identifier }
}

resource "aws_cloudwatch_metric_alarm" "aurora_connections" {
  alarm_name          = "${local.name}-aurora-connections"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.aurora_connection_threshold
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { DBClusterIdentifier = var.aurora_cluster_identifier }
}

resource "aws_cloudwatch_metric_alarm" "aurora_freeable_memory" {
  alarm_name          = "${local.name}-aurora-freeable-memory"
  namespace           = "AWS/RDS"
  metric_name         = "FreeableMemory"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 536870912
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { DBClusterIdentifier = var.aurora_cluster_identifier }
}

resource "aws_cloudwatch_metric_alarm" "valkey_cpu" {
  alarm_name          = "${local.name}-valkey-engine-cpu"
  namespace           = "AWS/ElastiCache"
  metric_name         = "EngineCPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 10
  threshold           = 75
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { ReplicationGroupId = var.valkey_replication_group_id }
}

resource "aws_cloudwatch_metric_alarm" "valkey_memory" {
  alarm_name          = "${local.name}-valkey-memory"
  namespace           = "AWS/ElastiCache"
  metric_name         = "DatabaseMemoryUsagePercentage"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { ReplicationGroupId = var.valkey_replication_group_id }
}

resource "aws_cloudwatch_metric_alarm" "mq_cpu" {
  alarm_name          = "${local.name}-mq-cpu"
  namespace           = "AWS/AmazonMQ"
  metric_name         = "SystemCpuUtilization"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 10
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { Broker = "${var.mq_broker_name}-1" }
}

resource "aws_cloudwatch_metric_alarm" "mq_memory" {
  alarm_name          = "${local.name}-mq-memory-alarm"
  namespace           = "AWS/AmazonMQ"
  metric_name         = "RabbitMQMemUsed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.mq_memory_threshold_bytes
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { Broker = "${var.mq_broker_name}-1" }
}

resource "aws_cloudwatch_metric_alarm" "mq_disk" {
  alarm_name          = "${local.name}-mq-disk-free"
  namespace           = "AWS/AmazonMQ"
  metric_name         = "RabbitMQDiskFree"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 5368709120
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { Broker = "${var.mq_broker_name}-1" }
}

resource "aws_cloudwatch_metric_alarm" "mq_queue_depth" {
  alarm_name          = "${local.name}-mq-message-backlog"
  namespace           = "AWS/AmazonMQ"
  metric_name         = "MessageCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 10
  threshold           = var.mq_backlog_threshold
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { Broker = "${var.mq_broker_name}-1", VirtualHost = "/" }
}

resource "aws_cloudwatch_metric_alarm" "ses_feedback_backlog" {
  alarm_name          = "${local.name}-ses-feedback-dlq"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { QueueName = var.ses_feedback_dlq_name }
}

resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = local.name
  dashboard_body = jsonencode({
    widgets = [
      { type = "metric", x = 0, y = 0, width = 12, height = 6, properties = { title = "ALB requests and 5xx", region = var.region, stat = "Sum", metrics = [["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix], [".", "HTTPCode_Target_5XX_Count", ".", "."]] } },
      { type = "metric", x = 12, y = 0, width = 12, height = 6, properties = { title = "Aurora CPU and connections", region = var.region, stat = "Average", metrics = [["AWS/RDS", "CPUUtilization", "DBClusterIdentifier", var.aurora_cluster_identifier], [".", "DatabaseConnections", ".", "."]] } },
      { type = "metric", x = 0, y = 6, width = 12, height = 6, properties = { title = "Valkey", region = var.region, stat = "Average", metrics = [["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", var.valkey_replication_group_id], [".", "DatabaseMemoryUsagePercentage", ".", "."]] } },
      { type = "metric", x = 12, y = 6, width = 12, height = 6, properties = { title = "Ledger imbalance", region = var.region, stat = "Maximum", metrics = [["Nantty/${var.environment}", "LedgerImbalance"]] } },
    ]
  })
}
