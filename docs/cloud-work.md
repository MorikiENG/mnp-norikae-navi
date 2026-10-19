# スマートフォンからクラウドで作業する

## Codexで作業を依頼する（推奨）

1. スマートフォンのブラウザで https://chatgpt.com/codex を開き、同じOpenAIアカウントでログインする。
2. GitHub連携から `MorikiENG/mnp-norikae-navi` を選ぶ。未表示なら、GitHub連携のアクセス対象とCodex環境のリポジトリ設定を確認する。
3. 環境のセットアップ欄がある場合、Node.js 24とPython 3を使う。外部npm依存はなく、npm installは不要。テストコマンドは下記参照。
4. 次の依頼文で開始する。このデスクトップの会話がWeb版へ引き継がれるとは限らないため、GitHub上のメモを正本とする。

```text
MorikiENG/mnp-norikae-navi の作業を続けてください。
最初に docs/cloud-work.md、docs/sitemap-audit.md、README.md を読んでください。
Search ConsoleのXML/TXTサイトマップ読み込み失敗は未解決です。
両方の公開URLテストは取得成功でした。私に最新ステータスを確認し、
原因を断定せず調査してください。ToolNestや会社HPは変更しないでください。
変更は別ブランチとPRで提示し、本番mainへ自動マージしないでください。
```

OpenAI/GitHubへのログインや環境選択は本人が行う。ここからWeb版の環境作成・アカウント利用可否の確認は行っていない。利用枠や料金は各サービスの契約画面で確認する。

## ブラウザで自分でも編集する：GitHub Codespaces

リポジトリの Code → Codespaces → 新規作成から起動できるよう、`.devcontainer/devcontainer.json` を用意した。Node.js 24、Python 3.12、確認用ポート4173を設定している。コンテナの実起動は未検証。

- https://github.com/MorikiENG/mnp-norikae-navi/codespaces
- Codespacesは利用枠超過で課金され得る。無料枠・支出制限を確認してから起動する。本作業ではインスタンスを作成していない。
- 開発は別ブランチで行う。mainへのpushはCloudflareの本番デプロイを起動する。
- ターミナルで `npm run preview` を実行し、Portsの4173から確認する。ポートはPrivateを維持する。
- 初期ビルドはnoindexで、サイトマップは生成しない。本番設定の検証は下記の明示コマンドを使う。
- 終了時はCodespaceをStopする。ブラウザを閉じるだけで停止したと判断しない。

## 検証コマンド

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
npm run preview
```

本番の生成物だけを確認する場合（デプロイはしない）：

```sh
CF_PAGES=1 CF_PAGES_BRANCH=main npm run build
```

## 引き継ぎ状況：2026年10月20日（日本時間）

- 本番 https://mnp-norikae-navi.pages.dev/ は正式公開承認済み。所有権確認済み。
- 実装コミット `1f95998` で同一20URLのXML/TXTを生成。Node45件・Python7件のテスト成功、Cloudflareデプロイ成功を確認。
- 利用者がTXTの全20URL表示を確認。Search ConsoleはXML/TXTとも「サイトマップを読み込めませんでした」。
- XMLの公開URLテストは利用者確認で成功。TXTも画面で2026/10/20 00:35:02、Google検査ツール（スマートフォン）、クロール許可はい、ページ取得成功、インデックス登録許可はいを確認。
- サイトマップ専用処理での取得・解析成功は未確認。公開URLテスト成功とは区別する。形式やCloudflare遮断を原因と断定しない。
- いったん変更・再送信を止め、翌日以降のサイトマップステータスを確認する方針。サイトマップ自体のインデックス登録リクエストは不要。
- Codex側HTTPクライアントではpages.devが403/error code 1010だった。Googleにも同じ拒否がある証拠にはしない。
- ToolNestと会社HPは読み取り調査のみ。変更禁止。
- 料金：12ブランド21代表プラン、2026/10/19確認、確認期限2026/11/18。広告未導入。料金候補PR #1は自動マージしない。

## スマートフォンで使うリンク

- 本番：https://mnp-norikae-navi.pages.dev/
- 診断：https://mnp-norikae-navi.pages.dev/diagnostics/
- Search Console：https://search.google.com/search-console
- Cloudflare：https://dash.cloudflare.com/
- ソース・PR：https://github.com/MorikiENG/mnp-norikae-navi

認証トークンやパスワードはリポジトリ・チャットへ貼らない。Search ConsoleやCloudflareの本人ログインはスマートフォン側で行う。
