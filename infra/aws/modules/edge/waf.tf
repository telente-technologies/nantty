resource "aws_wafv2_ip_set" "paystack" {
  name               = "${local.name}-paystack-webhook-ips"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = [for ip in var.paystack_webhook_ips : "${ip}/32"]
}

resource "aws_wafv2_web_acl" "this" {
  name  = local.name
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "paystack-webhook-source-ips"
    priority = 0
    action {
      block {}
    }
    statement {
      and_statement {
        statement {
          byte_match_statement {
            search_string         = "/webhooks/paystack"
            positional_constraint = "STARTS_WITH"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          not_statement {
            statement {
              ip_set_reference_statement {
                arn = aws_wafv2_ip_set.paystack.arn
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "paystack-webhook-source-ips"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "block-internal-paths"
    priority = 1
    action {
      block {}
    }
    statement {
      regex_match_statement {
        regex_string = "(^|/)internal(/|$)"
        field_to_match {
          uri_path {}
        }
        text_transformation {
          priority = 0
          type     = "URL_DECODE"
        }
        text_transformation {
          priority = 1
          type     = "LOWERCASE"
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "block-internal-paths"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-auth"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.auth_rate_limit_per_five_minutes
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/v1/auth/"
            positional_constraint = "STARTS_WITH"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-auth"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-all"
    priority = 3
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.global_rate_limit_per_five_minutes
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-all"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = {
      ip-reputation    = { priority = 10, name = "AWSManagedRulesAmazonIpReputationList" }
      common           = { priority = 11, name = "AWSManagedRulesCommonRuleSet" }
      known-bad-inputs = { priority = 12, name = "AWSManagedRulesKnownBadInputsRuleSet" }
      sqli             = { priority = 13, name = "AWSManagedRulesSQLiRuleSet" }
    }
    content {
      name     = rule.key
      priority = rule.value.priority
      override_action {
        none {}
      }
      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = "AWS"
          dynamic "rule_action_override" {
            for_each = rule.key == "common" ? ["SizeRestrictions_BODY"] : []
            content {
              name = rule_action_override.value
              action_to_use {
                count {}
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.key
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

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.this.arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${local.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }
  redacted_fields {
    single_header {
      name = "x-paystack-signature"
    }
  }
}
