# 新しくVPCを作らず、アカウントに最初から存在するデフォルトVPC/デフォルトサブネットを利用する。
# (NAT Gatewayなど追加コストのかかるリソースを避け、無料利用枠の範囲に収めるため)

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
