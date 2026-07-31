variable "aws_region" {
  description = "デプロイ先のAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "instance_type" {
  description = "EC2インスタンスタイプ(無料利用枠対象: t2.micro または t3.micro)"
  type        = string
  default     = "t3.micro"
}

variable "repo_url" {
  description = "EC2上にcloneするGitHubリポジトリのURL(Private repoのためgithub_patと組み合わせて認証する)"
  type        = string
  default     = "https://github.com/kiyota7/sns-app.git"
}

variable "repo_branch" {
  description = "cloneするブランチ名"
  type        = string
  default     = "main"
}

variable "github_pat" {
  description = "sns-appリポジトリ(Private)をEC2からclone/pullするためのGitHub Fine-grained PAT(Contents: Read-only)。terraform.tfvarsで上書きし、コミットしないこと"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "本番用JWT署名シークレット。terraform.tfvarsで上書きし、コミットしないこと"
  type        = string
  sensitive   = true
}

variable "allowed_http_cidr" {
  description = "フロントエンド(80番ポート)へのアクセスを許可するCIDR"
  type        = string
  default     = "0.0.0.0/0"
}
