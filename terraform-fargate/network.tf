# terraform/network.tf と同じ方針: 新しくVPCを作らず、アカウントに最初から存在する
# デフォルトVPC/デフォルトサブネットを利用する(NAT Gatewayなど追加コストのかかる
# リソースを避けるため)。
#
# デフォルトサブネットはAZごとに1つずつ存在し、既に2つ以上のAZにまたがっているため、
# RDSのサブネットグループが要求する「2つ以上のAZにまたがるサブネット」の条件も
# そのまま満たせる。RDSを外部に公開しない制御は、サブネットの公開/非公開ではなく
# security.tfのセキュリティグループ(RDSのSGはECSタスクのSGからの5432番のみ許可)で行う。

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
