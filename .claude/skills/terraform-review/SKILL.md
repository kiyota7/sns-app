---
name: terraform-review
description: Use this skill whenever reviewing, auditing, or quality-checking changes to files under terraform/ (*.tf, *.tfvars, *.tpl) in this repository — including as part of /code-review when the diff touches terraform/, or whenever the user asks for a Terraform/infrastructure quality check. Covers correctness, security, and cost/best-practice checks specific to this project's AWS infrastructure (EC2 + RDS + Docker Compose, no manual console operations).
---

# Terraformコード品質チェック

このプロジェクトのインフラ(`terraform/`配下)をレビューする際に確認する観点。
通常の`/code-review`(正しさ・簡潔さ・再利用性)に加えて、以下をチェックする。

## 1. 構文・整合性

- `terraform fmt -check -recursive`でフォーマットが揃っているか
- `terraform validate`が通るか(認証情報がある場合は`terraform plan`で実際の差分も確認する)
- 変数・出力に説明(`description`)が付いているか

## 2. シークレットの扱い

- パスワード等の変数に`sensitive = true`が付いているか
- `terraform.tfvars`・`*.tfstate*`・`.terraform/`が`.gitignore`対象になっているか
  (`.terraform.lock.hcl`はロックファイルなのでコミット対象でよい)
- user_data等のテンプレートに、平文の秘密情報をハードコードしていないか
  (変数経由で渡し、リポジトリにコミットされないようにする)

## 3. ネットワーク・セキュリティグループ

- インバウンドルールが必要最小限か(`0.0.0.0/0`を許可するのは、本当に外部公開が必要な
  ポート(例: Webの80/443番)に限定されているか)
- データベース(RDS)等、外部に公開する必要がないリソースは
  `publicly_accessible = false`とし、セキュリティグループも特定のリソース
  (EC2のセキュリティグループ等)からの通信のみを許可しているか
- SSH(22番)を開放していないか。EC2への操作はSSM Session Manager経由を優先する

## 4. IAM

- IAMロールに付与するポリシーは、目的に対して過剰でないか
  (学習用途で`AdministratorAccess`をIAM**ユーザー**に付与するのは許容するが、
  EC2等に紐づく**IAMロール**は用途に応じた最小限のポリシー(例: `AmazonSSMManagedInstanceCore`)
  にとどめる)

## 5. コスト意識

- 無料利用枠を優先する方針の場合、インスタンスサイズ・ストレージ量が無料利用枠の
  範囲(例: EC2 t2/t3.micro、RDS db.t2/t3/t4g.micro Single-AZ、EBS/RDSストレージ20〜30GB程度)
  に収まっているか
- NAT Gateway・Multi-AZ・ALB等、無料利用枠対象外で時間課金が発生するリソースを
  意図せず追加していないか
- Elastic IPは、インスタンスに割り当てた状態を維持しているか
  (未割り当て、またはインスタンス停止中のEIPは課金対象になる)

## 6. 状態管理・再現性

- `terraform destroy`で問題なく削除できるか(例: RDSの`skip_final_snapshot`設定漏れで
  destroyが止まらないか)
- AMI等を直接ハードコードせず、SSMパラメータ等から動的取得する形になっているか
  (リージョン移行・AMI更新への追従性)

## レビュー結果の報告

上記チェックで見つかった問題は、他の`/code-review`の指摘と同様に
「ファイル・該当箇所・具体的な不具合シナリオ」を添えて報告する。
設定値そのものの変更(コスト削減のためのインスタンスサイズ変更等)を伴う指摘は、
今回のPRスコープ外であれば別タスクとして切り出すことを検討する。
