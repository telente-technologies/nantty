terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name    = "zudomart-${var.environment}-cloudfront"
  account = data.aws_caller_identity.current.account_id
  region  = data.aws_region.current.name
  managed_rule_groups = {
    ip-reputation    = { priority = 10, name = "AWSManagedRulesAmazonIpReputationList", count = false }
    anonymous-ip     = { priority = 11, name = "AWSManagedRulesAnonymousIpList", count = var.anonymous_ip_action == "count" }
    common           = { priority = 12, name = "AWSManagedRulesCommonRuleSet", count = false }
    known-bad-inputs = { priority = 13, name = "AWSManagedRulesKnownBadInputsRuleSet", count = false }
    sqli             = { priority = 14, name = "AWSManagedRulesSQLiRuleSet", count = false }
  }
}

data "aws_iam_policy_document" "logs_key" {
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account}:root"]
    }
  }
  statement {
    sid       = "CloudWatchLogs"
    actions   = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${local.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${local.region}:${local.account}:log-group:aws-waf-logs-${local.name}"]
    }
  }
}

resource "aws_kms_key" "logs" {
  description             = "zudomart ${var.environment} cloudfront waf logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy                  = data.aws_iam_policy_document.logs_key.json
}

resource "aws_kms_alias" "logs" {
  name          = "alias/zudomart-${var.environment}-cloudfront-waf-logs"
  target_key_id = aws_kms_key.logs.key_id
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "aws-waf-logs-${local.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn
}

resource "aws_wafv2_web_acl" "this" {
  name  = local.name
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 0
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_five_minutes
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-rate-limit-per-ip"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = local.managed_rule_groups
    content {
      name     = rule.key
      priority = rule.value.priority
      override_action {
        dynamic "count" {
          for_each = rule.value.count ? [1] : []
          content {}
        }
        dynamic "none" {
          for_each = rule.value.count ? [] : [1]
          content {}
        }
      }
      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = "AWS"
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.name}-${rule.key}"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = local.name
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.this.arn]
  logging_filter {
    default_behavior = "DROP"
    filter {
      behavior    = "KEEP"
      requirement = "MEETS_ANY"
      condition {
        action_condition {
          action = "BLOCK"
        }
      }
      condition {
        action_condition {
          action = "COUNT"
        }
      }
    }
  }
  dynamic "redacted_fields" {
    for_each = toset(var.redacted_headers)
    content {
      single_header {
        name = redacted_fields.value
      }
    }
  }
}
