data "aws_iam_policy_document" "codedeploy_trust" {
  count = var.blue_green ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codedeploy.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codedeploy" {
  count              = var.blue_green ? 1 : 0
  name               = "${local.family}-codedeploy"
  assume_role_policy = data.aws_iam_policy_document.codedeploy_trust[0].json
}

resource "aws_iam_role_policy_attachment" "codedeploy" {
  count      = var.blue_green ? 1 : 0
  role       = aws_iam_role.codedeploy[0].name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

resource "aws_codedeploy_app" "this" {
  count            = var.blue_green ? 1 : 0
  name             = local.family
  compute_platform = "ECS"
}

resource "aws_codedeploy_deployment_group" "this" {
  count                  = var.blue_green ? 1 : 0
  app_name               = aws_codedeploy_app.this[0].name
  deployment_group_name  = local.family
  service_role_arn       = aws_iam_role.codedeploy[0].arn
  deployment_config_name = var.codedeploy_config

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = length(var.blue_green_alarm_names) > 0
    alarms  = var.blue_green_alarm_names
  }

  blue_green_deployment_config {
    deployment_ready_option { action_on_timeout = "CONTINUE_DEPLOYMENT" }
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 30
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  ecs_service {
    cluster_name = var.cluster_name
    service_name = aws_ecs_service.this.name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route { listener_arns = [var.blue_green_listener_arn] }
      target_group { name = aws_lb_target_group.this["blue"].name }
      target_group { name = aws_lb_target_group.this["green"].name }
    }
  }
}
