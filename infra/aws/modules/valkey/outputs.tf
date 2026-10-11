output "primary_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "url_secret_arn" { value = aws_secretsmanager_secret.url.arn }
output "replication_group_id" { value = aws_elasticache_replication_group.this.id }
output "auth_token" {
  value     = random_password.auth.result
  sensitive = true
}
output "security_group_id" { value = aws_security_group.valkey.id }
