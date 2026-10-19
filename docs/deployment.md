# Cloudflare Pages 公開準備

現状は静的ビルド完成・未デプロイ。本人によるCloudflareログインと、料金・画面検証後の公開判断が必要です。課金やドメイン購入は実施していません。

## プレビュー準備

1. Cloudflareに本人がログインし、Workers & Pages → Pages → Gitに接続。
2. `MorikiENG/mnp-norikae-navi` だけを選択。ToolNestは対象にしない。
3. Framework preset：None、Root directory：空欄、Build command：`npm run build`、Build output directory：`dist`。
4. Nodeの環境変数 `NODE_VERSION=24` を設定。`PRODUCTION`、`PUBLICATION_APPROVED` は未設定のままにする。
5. この段階のデプロイも外部配信になるため、実施前に本人の公開許可を得る。noindexはアクセス制限ではない。非公開QAが必要ならCloudflare Access等でアクセスを制限する。

## 公開前に確認するもの

- `docs/data-review.md` の公式出典を再確認、確認日・期限の更新。
- 特に予定改定のあるahamo、受付終了予定のドコモminiを確認。
- ワイモバイルは確認が終わるまでpendingを維持。
- `npm test` と `python3 -m unittest discover -s tests -p 'test_*.py'` を実行。
- 実機のSafari/Chromeで狭い画面、入力、比較期間切替、詳細条件、CSV、キーボード操作、エラーを確認。
- グラフ・比較表と手計算を照合。広告ブロッカー有効時も確認。
- 問い合わせ窓口の公開可否・連絡方法を運営者が確定。現在はGitHub Issuesへのリンク。
- 広告は未承認のまま無効を維持。

## 本番のビルド設定

公開先URLが確定し、本人が公開承認した後に本番環境だけへ設定：

```text
SITE_URL=https://実際の公開ホスト名
PRODUCTION=true
PUBLICATION_APPROVED=true
NODE_VERSION=24
```

URLにパスや末尾スラッシュを含めない。ビルドはURL・承認の不足を拒否し、設定済みのときだけcanonical・sitemapとクロール許可を生成する。プレビュー環境はPRODUCTIONをfalseにする。

デプロイ完了後、HTTPS、404、`robots.txt`、`sitemap.xml`、`_headers` の適用、計算の動作を確認。Search Consoleへの登録・サイトマップ送信は本人アカウントで実施する。

## GitHub設定

- Actionsを有効化し、CI実行結果を確認。
- Settings → Actions → General の「Allow GitHub Actions to create and approve pull requests」を有効化（PRの自動承認は実装していない）。
- `main` の保護・レビュー必須を推奨。料金変更は必ず公式参照元と確認記録を添える。
- 定期変更検知は毎週月曜06:17 JST。Publicリポジトリでは長期間活動がないとスケジュールが停止する場合があるため、Actionsの状態も運用で確認する。
- CIは静的サイトを検証するだけで、Cloudflareを操作しない。

## ロールバック

料金誤り時は誤ったプランをpendingへ変更して除外し、再検証して更新する。公開済みの場合はCloudflare Pagesで直前の正常デプロイへロールバックできる。確認候補のマージだけでは料金本体は変わらない。

## 実行確認で判明した残作業

GitHub CIは成功。変更検知の手動実行では候補ブランチを作成できたが、GitHub ActionsからのPR作成は設定で拒否された。本人が上記の「Allow GitHub Actions to create and approve pull requests」を有効化した後、tariff-watchを再実行して自動PR作成を確認する。接続済み権限で作成した確認候補PR #1は未マージで残している。
