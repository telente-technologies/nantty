terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.70"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

resource "aws_route53_zone" "this" {
  count = var.create_zone ? 1 : 0
  name  = var.zone_name
}

data "aws_route53_zone" "existing" {
  count        = var.create_zone ? 0 : 1
  name         = var.zone_name
  private_zone = false
}

locals {
  zone_id = var.create_zone ? aws_route53_zone.this[0].zone_id : data.aws_route53_zone.existing[0].zone_id
}

resource "aws_acm_certificate" "api" {
  domain_name               = var.api_domain
  subject_alternative_names = var.extra_api_domains
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_acm_certificate" "media" {
  provider          = aws.us_east_1
  domain_name       = var.media_domain
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

locals {
  validation_records = merge(
    { for option in aws_acm_certificate.api.domain_validation_options : "api-${option.domain_name}" => option },
    { for option in aws_acm_certificate.media.domain_validation_options : "media-${option.domain_name}" => option },
  )
}

resource "aws_route53_record" "validation" {
  for_each        = local.validation_records
  zone_id         = local.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for key, record in aws_route53_record.validation : record.fqdn if startswith(key, "api-")]
}

resource "aws_acm_certificate_validation" "media" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.media.arn
  validation_record_fqdns = [for key, record in aws_route53_record.validation : record.fqdn if startswith(key, "media-")]
}
