# ALB(Application Load Balancer)。CloudFrontのオリジンとしてバックエンドAPIへの
# トラフィックを受け、Fargateタスク(複数可、awsvpcネットワークモードのためip
# ターゲットタイプ)へ振り分ける。
#
# HTTPS/独自ドメイン(ACM証明書)は今回のスコープ外。CloudFront自身が
# *.cloudfront.netの証明書で利用者向けにはHTTPS化するため、
# CloudFront〜ALB間はHTTPのままとしている(AWS内部区間のため許容)。

resource "aws_lb" "this" {
  name               = "sns-app-fargate-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids

  tags = {
    Name = "sns-app-fargate-alb"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "sns-app-fargate-backend-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip" # Fargate(awsvpcネットワークモード)を対象にする場合はip固定

  health_check {
    # 専用のヘルスチェック用エンドポイントは追加せず、既存の /api/auth/me を流用する。
    # 未認証なので401が返るが、それ自体が「アプリが正常に応答している」証拠になる
    # (frontend/e2e/global-setup.ts や .github/workflows/ci.yml の起動待機と同じ考え方)。
    path                = "/api/auth/me"
    matcher             = "401"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "sns-app-fargate-backend-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
