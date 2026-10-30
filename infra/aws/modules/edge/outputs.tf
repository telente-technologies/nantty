output "alb_arn" { value = aws_lb.this.arn }
output "alb_arn_suffix" { value = aws_lb.this.arn_suffix }
output "alb_dns_name" { value = aws_lb.this.dns_name }
output "alb_zone_id" { value = aws_lb.this.zone_id }
output "alb_security_group_id" { value = aws_security_group.alb.id }
output "https_listener_arn" { value = aws_lb_listener.https.arn }
output "web_acl_arn" { value = aws_wafv2_web_acl.this.arn }
