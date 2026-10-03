output "cluster_arn" { value = aws_rds_cluster.this.arn }
output "cluster_identifier" { value = aws_rds_cluster.this.id }
output "writer_endpoint" { value = aws_rds_cluster.this.endpoint }
output "proxy_endpoint" { value = aws_db_proxy.this.endpoint }
output "proxy_reader_endpoint" { value = aws_db_proxy_endpoint.reader.endpoint }
output "master_secret_arn" { value = aws_rds_cluster.this.master_user_secret[0].secret_arn }
output "service_role_secret_arns" { value = { for role, secret in aws_secretsmanager_secret.service_roles : role => secret.arn } }
output "security_group_id" { value = aws_security_group.database.id }
