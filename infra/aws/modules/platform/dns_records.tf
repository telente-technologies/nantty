resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = local.api_domain
  type    = "CNAME"
  content = module.edge.alb_dns_name
  proxied = true
  ttl     = 1
  comment = "Nantty API proxied through Cloudflare"
}

resource "cloudflare_dns_record" "media" {
  zone_id = var.cloudflare_zone_id
  name    = local.media_domain
  type    = "CNAME"
  content = module.storage.media_distribution_domain_name
  proxied = false
  ttl     = 1
  comment = "Nantty media delivered by CloudFront"
}

resource "cloudflare_dns_record" "livekit" {
  count   = var.livekit_mode == "self_hosted" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = local.livekit_domain
  type    = "CNAME"
  content = module.edge.alb_dns_name
  proxied = true
  ttl     = 1
  comment = "Nantty LiveKit signaling proxied through Cloudflare"
}

resource "aws_route53_record" "api" {
  zone_id = module.dns.zone_id
  name    = local.api_domain
  type    = "A"
  alias {
    name                   = module.edge.alb_dns_name
    zone_id                = module.edge.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_ipv6" {
  zone_id = module.dns.zone_id
  name    = local.api_domain
  type    = "AAAA"
  alias {
    name                   = module.edge.alb_dns_name
    zone_id                = module.edge.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "media" {
  zone_id = module.dns.zone_id
  name    = local.media_domain
  type    = "A"
  alias {
    name                   = module.storage.media_distribution_domain_name
    zone_id                = module.storage.media_distribution_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "media_ipv6" {
  zone_id = module.dns.zone_id
  name    = local.media_domain
  type    = "AAAA"
  alias {
    name                   = module.storage.media_distribution_domain_name
    zone_id                = module.storage.media_distribution_zone_id
    evaluate_target_health = false
  }
}
