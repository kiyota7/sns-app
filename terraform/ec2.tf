# AMI IDをハードコードせず、AWSが公式に提供するSSMパラメータから
# 常に最新のAmazon Linux 2023(x86_64)のAMIを動的に取得する。
data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_ami.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_ssm.name

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
  }

  # Private repoのためgithub_patを埋め込んだ認証付きclone URLをTerraform側で組み立てる
  # (bashの${VAR}展開とtemplatefileの${}展開が衝突しないよう、user_data.sh.tpl側では
  # 完成済みのURLをそのまま使うだけにする)
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    repo_clone_url = replace(var.repo_url, "https://", "https://x-access-token:${var.github_pat}@")
    repo_branch    = var.repo_branch
    jwt_secret     = var.jwt_secret
    s3_bucket_name = aws_s3_bucket.uploads.bucket
    aws_region     = var.aws_region
  })

  tags = {
    Name = "sns-app-app"
  }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "sns-app-app-eip"
  }
}
