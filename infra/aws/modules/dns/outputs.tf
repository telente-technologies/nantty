output "zone_id" { value = local.zone_id }
output "api_certificate_arn" { value = aws_acm_certificate_validation.api.certificate_arn }
output "media_certificate_arn" { value = aws_acm_certificate_validation.media.certificate_arn }
output "name_servers" { value = var.create_zone ? aws_route53_zone.this[0].name_servers : [] }
