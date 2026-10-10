output "web_acl_arn" { value = aws_wafv2_web_acl.this.arn }
output "log_group_name" { value = aws_cloudwatch_log_group.this.name }
output "logs_kms_key_arn" { value = aws_kms_key.logs.arn }
