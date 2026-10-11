output "broker_id" { value = aws_mq_broker.this.id }
output "broker_arn" { value = aws_mq_broker.this.arn }
output "admin_secret_arn" { value = aws_secretsmanager_secret.admin.arn }
output "service_user_secret_arns" { value = { for user, secret in aws_secretsmanager_secret.service_users : user => secret.arn } }
output "broker_name" { value = aws_mq_broker.this.broker_name }
output "security_group_id" { value = aws_security_group.broker.id }
