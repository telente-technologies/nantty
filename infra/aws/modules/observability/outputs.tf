output "alarm_topic_arn" { value = aws_sns_topic.alarms.arn }
output "ledger_imbalance_alarm_name" { value = aws_cloudwatch_metric_alarm.ledger_imbalance.alarm_name }
output "alb_5xx_alarm_name" { value = aws_cloudwatch_metric_alarm.alb_5xx_rate.alarm_name }
