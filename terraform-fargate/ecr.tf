# バックエンドのDockerイメージ(backend/Dockerfileをそのまま利用、変更不要)を
# 保存するECRリポジトリ。イメージのbuild/pushはTerraformでは管理せず、
# build-and-push.shで別途行う(Dockerイメージの内容はTerraform stateで
# 追跡するのに向いていないため。詳細はREADME/docs参照)。

resource "aws_ecr_repository" "backend" {
  name                 = "sns-app-fargate-backend"
  image_tag_mutability = "MUTABLE"

  # terraform destroy時にイメージが残っていてもリポジトリごと削除できるようにする
  # (既存terraform/s3.tfのforce_destroyと同じ「気軽に畳める」方針)。
  force_delete = true

  tags = {
    Name = "sns-app-fargate-backend"
  }
}

# 古いイメージが無制限に溜まってストレージ費用がかさまないよう、
# 直近5件のみ保持する。
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "直近5件のイメージのみ保持する"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
