output "api_url" { value = module.platform.api_url }
output "media_url" { value = module.platform.media_url }
output "cluster_name" { value = module.platform.cluster_name }
output "ecr_repository_urls" { value = module.platform.ecr_repository_urls }
output "github_ecr_push_role_arn" { value = module.platform.github_ecr_push_role_arn }
output "github_deploy_role_arn" { value = module.platform.github_deploy_role_arn }
output "name_servers" { value = module.platform.name_servers }
output "nat_public_ips" {
  description = "Fixed egress IPs (one Elastic IP per AZ NAT gateway); register these with Flutterwave IP whitelisting."
  value       = module.platform.nat_public_ips
}
output "aurora_master_secret_arn" { value = module.platform.aurora_master_secret_arn }
output "mq_admin_secret_arn" { value = module.platform.mq_admin_secret_arn }
output "rds_proxy_endpoint" { value = module.platform.rds_proxy_endpoint }
output "alarm_topic_arn" { value = module.platform.alarm_topic_arn }
