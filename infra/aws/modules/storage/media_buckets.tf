# Media service layout: uploads (private originals, quarantined until scanned), public
# derivatives (read only by CloudFront OAC under /m/*) and private derivatives (chat, KYC,
# documents; signed CloudFront URLs under /p/* or presigned S3 URLs). All KMS, no public access.

locals {
  media_service_buckets = {
    uploads = { cors_methods = ["PUT", "GET", "HEAD"], cloudfront_prefix = null }
    public  = { cors_methods = [], cloudfront_prefix = "m/" }
    private = { cors_methods = ["GET", "HEAD"], cloudfront_prefix = "p/" }
  }
}

resource "aws_s3_bucket" "media_service" {
  for_each = local.media_service_buckets
  bucket   = "${local.prefix}-media-${each.key}"
}

resource "aws_s3_bucket_ownership_controls" "media_service" {
  for_each = local.media_service_buckets
  bucket   = aws_s3_bucket.media_service[each.key].id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_versioning" "media_service" {
  for_each = local.media_service_buckets
  bucket   = aws_s3_bucket.media_service[each.key].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "media_service" {
  for_each                = local.media_service_buckets
  bucket                  = aws_s3_bucket.media_service[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media_service" {
  for_each = local.media_service_buckets
  bucket   = aws_s3_bucket.media_service[each.key].id
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.media.arn
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "media_service" {
  for_each = { for name, bucket in local.media_service_buckets : name => bucket if length(bucket.cors_methods) > 0 }
  bucket   = aws_s3_bucket.media_service[each.key].id
  cors_rule {
    allowed_methods = each.value.cors_methods
    allowed_origins = var.upload_cors_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media_service" {
  for_each = local.media_service_buckets
  bucket   = aws_s3_bucket.media_service[each.key].id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 2 }
  }
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

resource "aws_s3_bucket_logging" "media_service" {
  for_each      = local.media_service_buckets
  bucket        = aws_s3_bucket.media_service[each.key].id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access/media-${each.key}/"
}

data "aws_iam_policy_document" "media_service" {
  for_each = local.media_service_buckets
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.media_service[each.key].arn, "${aws_s3_bucket.media_service[each.key].arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
  dynamic "statement" {
    for_each = each.value.cloudfront_prefix == null ? [] : [each.value.cloudfront_prefix]
    content {
      sid       = "CloudFrontReadsDerivatives"
      actions   = ["s3:GetObject"]
      resources = ["${aws_s3_bucket.media_service[each.key].arn}/${statement.value}*"]
      principals {
        type        = "Service"
        identifiers = ["cloudfront.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "aws:SourceArn"
        values   = [aws_cloudfront_distribution.media.arn]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "media_service" {
  for_each   = local.media_service_buckets
  bucket     = aws_s3_bucket.media_service[each.key].id
  policy     = data.aws_iam_policy_document.media_service[each.key].json
  depends_on = [aws_s3_bucket_public_access_block.media_service]
}
