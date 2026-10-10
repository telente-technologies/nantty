resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "zudomart-${var.environment}-media"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_public_key" "media_signing" {
  count       = var.media_signing_public_key_pem == null ? 0 : 1
  name        = "zudomart-${var.environment}-media-signing"
  encoded_key = var.media_signing_public_key_pem
}

resource "aws_cloudfront_key_group" "media_signing" {
  count = var.media_signing_public_key_pem == null ? 0 : 1
  name  = "zudomart-${var.environment}-media-signing"
  items = [aws_cloudfront_public_key.media_signing[0].id]
}

resource "aws_cloudfront_distribution" "media" {
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"
  comment         = "zudomart ${var.environment} media"
  aliases         = [var.media_domain]
  price_class     = var.cloudfront_price_class
  web_acl_id      = var.web_acl_arn

  origin {
    origin_id                = "primary"
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_path              = "/processed"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  dynamic "origin" {
    for_each = var.enable_dr ? [1] : []
    content {
      origin_id                = "dr"
      domain_name              = aws_s3_bucket.media_dr[0].bucket_regional_domain_name
      origin_path              = "/processed"
      origin_access_control_id = aws_cloudfront_origin_access_control.media.id
    }
  }

  dynamic "origin_group" {
    for_each = var.enable_dr ? [1] : []
    content {
      origin_id = "failover"
      failover_criteria { status_codes = [500, 502, 503, 504, 403, 404] }
      member { origin_id = "primary" }
      member { origin_id = "dr" }
    }
  }

  default_cache_behavior {
    target_origin_id           = var.enable_dr ? "failover" : "primary"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.media_signing_public_key_pem == null ? [] : [1]
    content {
      path_pattern               = "/paid/*"
      target_origin_id           = var.enable_dr ? "failover" : "primary"
      viewer_protocol_policy     = "https-only"
      allowed_methods            = ["GET", "HEAD"]
      cached_methods             = ["GET", "HEAD"]
      compress                   = true
      cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
      response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"
      trusted_key_groups         = [aws_cloudfront_key_group.media_signing[0].id]
    }
  }

  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/media/"
    include_cookies = false
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.media_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
