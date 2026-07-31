# SSH(22番ポート)は開放しない。EC2への操作はSSM Session Manager経由で行うため、
# インバウンドはアプリの公開ポート(80番)のみ許可する。

resource "aws_security_group" "app" {
  name        = "sns-app-sg"
  description = "Allow HTTP inbound, all outbound"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.allowed_http_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sns-app-sg"
  }
}
