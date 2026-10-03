resource "aws_route53_record" "api" {
  zone_id = local.zone_id
  name    = var.api_domain
  type    = "A"
  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_ipv6" {
  zone_id = local.zone_id
  name    = var.api_domain
  type    = "AAAA"
  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "media" {
  zone_id = local.zone_id
  name    = var.media_domain
  type    = "A"
  alias {
    name                   = var.media_distribution_domain_name
    zone_id                = var.media_distribution_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "media_ipv6" {
  zone_id = local.zone_id
  name    = var.media_domain
  type    = "AAAA"
  alias {
    name                   = var.media_distribution_domain_name
    zone_id                = var.media_distribution_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_health_check" "api" {
  fqdn              = var.api_domain
  port              = 443
  type              = "HTTPS"
  resource_path     = "/healthz"
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true
  tags              = { Name = "${var.api_domain}-health" }
}
