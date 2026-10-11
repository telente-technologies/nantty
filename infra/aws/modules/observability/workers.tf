# Supervised background workers (servicemodule.SuperviseWorker*) log this message on every
# restart. A worker that keeps failing stays invisible to HTTP health, so alarm on it.
resource "aws_cloudwatch_log_metric_filter" "worker_restarts" {
  for_each       = var.service_log_group_names
  name           = "${local.name}-${each.key}-worker-restarts"
  log_group_name = each.value
  pattern        = "{ $.msg = \"background worker stopped; restarting\" }"
  metric_transformation {
    name          = "BackgroundWorkerRestarts"
    namespace     = "Zudomart/${var.environment}"
    value         = "1"
    default_value = "0"
    dimensions    = { service = "$.service" }
  }
}

resource "aws_cloudwatch_metric_alarm" "worker_restarts" {
  for_each            = var.service_log_group_names
  alarm_name          = "${local.name}-${each.key}-worker-restarting"
  alarm_description   = "A supervised background worker (consumer, relay, job loop) restarted repeatedly in ${each.key}."
  namespace           = "Zudomart/${var.environment}"
  metric_name         = "BackgroundWorkerRestarts"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 3
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions          = { service = each.key }
}
