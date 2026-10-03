resource "aws_s3_bucket" "media_dr" {
  provider = aws.dr
  count    = var.enable_dr ? 1 : 0
  bucket   = "${local.media_bucket}-dr"
}

resource "aws_s3_bucket" "kyc_dr" {
  provider            = aws.dr
  count               = var.enable_dr ? 1 : 0
  bucket              = "${local.kyc_bucket}-dr"
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "media_dr" {
  provider = aws.dr
  count    = var.enable_dr ? 1 : 0
  bucket   = aws_s3_bucket.media_dr[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "kyc_dr" {
  provider = aws.dr
  count    = var.enable_dr ? 1 : 0
  bucket   = aws_s3_bucket.kyc_dr[0].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "dr" {
  provider                = aws.dr
  for_each                = var.enable_dr ? { media = aws_s3_bucket.media_dr[0].id, kyc = aws_s3_bucket.kyc_dr[0].id } : {}
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kyc_dr" {
  provider = aws.dr
  count    = var.enable_dr ? 1 : 0
  bucket   = aws_s3_bucket.kyc_dr[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kyc_dr_kms_key_arn
    }
  }
}

data "aws_iam_policy_document" "replication_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "replication" {
  count = var.enable_dr ? 1 : 0
  statement {
    actions   = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn, aws_s3_bucket.kyc.arn]
  }
  statement {
    actions   = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging", "s3:GetObjectRetention", "s3:GetObjectLegalHold"]
    resources = ["${aws_s3_bucket.media.arn}/*", "${aws_s3_bucket.kyc.arn}/*"]
  }
  statement {
    actions   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags", "s3:ObjectOwnerOverrideToBucketOwner"]
    resources = ["${aws_s3_bucket.media_dr[0].arn}/*", "${aws_s3_bucket.kyc_dr[0].arn}/*"]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = [var.kyc_kms_key_arn]
  }
  statement {
    actions   = ["kms:Encrypt", "kms:GenerateDataKey"]
    resources = [var.kyc_dr_kms_key_arn]
  }
}

resource "aws_iam_role" "replication" {
  count              = var.enable_dr ? 1 : 0
  name               = "zudomart-${var.environment}-s3-replication"
  assume_role_policy = data.aws_iam_policy_document.replication_trust.json
}

resource "aws_iam_role_policy" "replication" {
  count  = var.enable_dr ? 1 : 0
  role   = aws_iam_role.replication[0].id
  policy = data.aws_iam_policy_document.replication[0].json
}

resource "aws_s3_bucket_replication_configuration" "media" {
  count      = var.enable_dr ? 1 : 0
  bucket     = aws_s3_bucket.media.id
  role       = aws_iam_role.replication[0].arn
  depends_on = [aws_s3_bucket_versioning.media, aws_s3_bucket_versioning.media_dr]
  rule {
    id       = "all-media"
    status   = "Enabled"
    priority = 1
    filter {}
    delete_marker_replication { status = "Disabled" }
    destination {
      bucket        = aws_s3_bucket.media_dr[0].arn
      storage_class = "STANDARD_IA"
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

resource "aws_s3_bucket_replication_configuration" "kyc" {
  count      = var.enable_dr ? 1 : 0
  bucket     = aws_s3_bucket.kyc.id
  role       = aws_iam_role.replication[0].arn
  depends_on = [aws_s3_bucket_versioning.kyc, aws_s3_bucket_versioning.kyc_dr]
  rule {
    id       = "kyc"
    status   = "Enabled"
    priority = 1
    filter {}
    delete_marker_replication { status = "Disabled" }
    source_selection_criteria {
      sse_kms_encrypted_objects { status = "Enabled" }
    }
    destination {
      bucket = aws_s3_bucket.kyc_dr[0].arn
      encryption_configuration { replica_kms_key_id = var.kyc_dr_kms_key_arn }
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

data "aws_iam_policy_document" "media_dr" {
  count = var.enable_dr ? 1 : 0
  statement {
    sid       = "CloudFrontFailoverReads"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media_dr[0].arn}/*"]
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

resource "aws_s3_bucket_policy" "media_dr" {
  provider   = aws.dr
  count      = var.enable_dr ? 1 : 0
  bucket     = aws_s3_bucket.media_dr[0].id
  policy     = data.aws_iam_policy_document.media_dr[0].json
  depends_on = [aws_s3_bucket_public_access_block.dr]
}
