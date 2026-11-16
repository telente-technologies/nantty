terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}
locals {
  name = "nantty-${var.environment}"
}

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "Public ALB"
  vpc_id      = var.vpc_id
  dynamic "ingress" {
    for_each = toset(var.cloudflare_ipv4_cidrs)
    content {
      description = "HTTPS from Cloudflare"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }
  dynamic "ingress" {
    for_each = toset(var.cloudflare_ipv6_cidrs)
    content {
      description      = "HTTPS from Cloudflare"
      from_port        = 443
      to_port          = 443
      protocol         = "tcp"
      ipv6_cidr_blocks = [ingress.value]
    }
  }
  dynamic "ingress" {
    for_each = toset(var.cloudflare_ipv4_cidrs)
    content {
      description = "HTTP redirect from Cloudflare"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }
  dynamic "ingress" {
    for_each = toset(var.cloudflare_ipv6_cidrs)
    content {
      description      = "HTTP redirect from Cloudflare"
      from_port        = 80
      to_port          = 80
      protocol         = "tcp"
      ipv6_cidr_blocks = [ingress.value]
    }
  }
  egress {
    description = "To task TLS proxies inside the VPC"
    from_port   = 18443
    to_port     = 18443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_lb" "this" {
  name                       = local.name
  load_balancer_type         = "application"
  subnets                    = var.public_subnet_ids
  security_groups            = [aws_security_group.alb.id]
  idle_timeout               = 3600
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection
  enable_http2               = true
  desync_mitigation_mode     = "strictest"

  access_logs {
    bucket  = var.logs_bucket_id
    prefix  = "alb"
    enabled = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"message\":\"Not found.\",\"code\":\"NOT_FOUND\"}"
      status_code  = "404"
    }
  }
}
