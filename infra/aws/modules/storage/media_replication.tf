# Cross-region DR for the media service buckets, same pattern as the media bucket: versioned
# replicas re-encrypted with the DR media key, no delete-marker replication. Uploads are staging
# for the scan/derivative pipeline, so their replicas expire after 7 days.

locals {
  media_service_dr = var.enable_dr ? local.media_service_buckets : {}
}

resource "aws_s3_bucket" "media_service_dr" {
  provider = aws.dr
  for_each = local.media_service_dr
  bucket   = "${aws_s3_bucket.media_service[each.key].id}-dr"
}

resource "aws_s3_bucket_versioning" "media_service_dr" {
  provider = aws.dr
  for_each = local.media_service_dr
  bucket   = aws_s3_bucket.media_service_dr[each.key].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "media_service_dr" {
  provider                = aws.dr
  for_each                = local.media_service_dr
  bucket                  = aws_s3_bucket.media_service_dr[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media_service_dr" {
  provider = aws.dr
  for_each = local.media_service_dr
  bucket   = aws_s3_bucket.media_service_dr[each.key].id
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.media_dr[0].arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media_service_dr" {
  provider = aws.dr
  for_each = local.media_service_dr
  bucket   = aws_s3_bucket.media_service_dr[each.key].id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
  dynamic "rule" {
    for_each = each.key == "uploads" ? [1] : []
    content {
      id     = "expire-staging-uploads"
      status = "Enabled"
      filter {}
      expiration { days = 7 }
    }
  }
}

data "aws_iam_policy_document" "media_service_replication" {
  count = var.enable_dr ? 1 : 0
  statement {
    actions   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
    resources = [for name in keys(local.media_service_dr) : aws_s3_bucket.media_service[name].arn]
  }
  statement {
    actions   = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging"]
    resources = [for name in keys(local.media_service_dr) : "${aws_s3_bucket.media_service[name].arn}/*"]
  }
  statement {
    actions   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags", "s3:ObjectOwnerOverrideToBucketOwner"]
    resources = [for name in keys(local.media_service_dr) : "${aws_s3_bucket.media_service_dr[name].arn}/*"]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.media.arn]
  }
  statement {
    actions   = ["kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.media_dr[0].arn]
  }
}

resource "aws_iam_role_policy" "media_service_replication" {
  count  = var.enable_dr ? 1 : 0
  name   = "media-service-buckets"
  role   = aws_iam_role.replication[0].id
  policy = data.aws_iam_policy_document.media_service_replication[0].json
}

resource "aws_s3_bucket_replication_configuration" "media_service" {
  for_each   = local.media_service_dr
  bucket     = aws_s3_bucket.media_service[each.key].id
  role       = aws_iam_role.replication[0].arn
  depends_on = [aws_s3_bucket_versioning.media_service, aws_s3_bucket_versioning.media_service_dr]
  rule {
    id       = "media-${each.key}"
    status   = "Enabled"
    priority = 1
    filter {}
    delete_marker_replication { status = "Disabled" }
    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }
    destination {
      bucket        = aws_s3_bucket.media_service_dr[each.key].arn
      storage_class = "STANDARD_IA"
      encryption_configuration { replica_kms_key_id = aws_kms_key.media_dr[0].arn }
      metrics {
        status = "Enabled"
        event_threshold { minutes = 15 }
      }
      replication_time {
        status = "Enabled"
        time { minutes = 15 }
      }
    }
  }
}
