resource "cloudflare_dns_record" "validation" {
  for_each = local.validation_records
  zone_id  = var.cloudflare_zone_id
  name     = trimsuffix(each.value.resource_record_name, ".")
  type     = each.value.resource_record_type
  content  = trimsuffix(each.value.resource_record_value, ".")
  proxied  = false
  ttl      = 1
  comment  = "ACM certificate validation for ${each.value.domain_name}"
}
