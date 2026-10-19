# 検証結果

検証日：2026年10月19日。

- Node.js標準テスト：31件成功、失敗0。
- Python変更検知テスト：6件成功、失敗0。
- 合計37件。料金データスキーマ、境界条件、未確認・期限切れの拒否、特典の対象期間と条件、受取月、ポイントの順位不算入、残債の相殺、割引終了、予定改定、同月契約開始、損益分岐点を含む。
- 全生成HTMLの言語・タイトル・description・JSON-LD、内部ページ・アセット参照、未承認広告不配信、noindex、公開設定不足の拒否、CSPを検証。
- `npm run build` 成功。外部npm依存なし。
- `node --check` によるブラウザ用モジュールの構文確認成功。
- 内部HTTPでトップ、料金JSON、JS、ahamo詳細、プライバシー、robots、sitemapが200、未知ページ404となることを確認。
- 料金の手計算は `docs/data-review.md` の6/12/24か月例と一致。
- 変更検知を公式23URLに実行。20URL取得成功、3URL取得失敗（LINEMO2、ワイモバイル1、いずれも403）。候補にURLと失敗理由を記録。確認済みカタログを自動変更しないことを確認。

## 未実施の検証

ブラウザ操作用ツールとリモートプレビュー転送機能がこの環境にないため、実ブラウザの描画・クリック・モバイル実機・スクリーンリーダー・広告ブロッカーの検証は未実施。静的マークアップ検証はブラウザ検証の代替ではない。

Cloudflareでの配信・HTTPヘッダー適用・本番ドメイン、AdSense実広告、承認済み広告リンクの表示は未検証。本人の公開許可とサービス設定後に実施する。

GitHub Actionsのリポジトリ設定読み取りは接続権限不足（403）で、PR作成許可の状態を確認できない。定期ジョブとPR作成の運用有効化は `docs/deployment.md` に従って確認する。

## GitHubでの実行

- [Verify static site](https://github.com/MorikiENG/mnp-norikae-navi/actions/runs/39265046507)：成功。GitHub上でもNode/Pythonテストと静的ビルドを実行済み。
- [Official tariff change candidates](https://github.com/MorikiENG/mnp-norikae-navi/actions/runs/39265106968)：検知と候補ブランチへのpushは成功、PR作成はリポジトリ設定で拒否。エラーは `GitHub Actions is not permitted to create or approve pull requests`。
- [確認候補PR #1](https://github.com/MorikiENG/mnp-norikae-navi/pull/1)：接続済みのGitHub権限で作成。未マージ。料金カタログの変更なし。
- GitHubランナーではLINEMO2ページとワイモバイルを取得できた。一方、ahamo2ページは `UNSAFE_LEGACY_RENEGOTIATION_DISABLED` で取得不能。この環境差も候補に記録し、TLS検証を弱めたり料金を推測したりしていない。

今後の自動PRにはGitHub Settings → Actions → General → Allow GitHub Actions to create and approve pull requestsを有効にする必要がある。設定変更は未実施。自動承認・自動マージは実装していない。

## 共同作業の再開時に追加した検証

本番ビルドのcanonical・sitemap・robotsと未確認ページの検索除外、文字列falseを公開承認にしないことの2件を追加。外部公開を伴わず一時ディレクトリで検証。Node33件＋Python6件、計39件が成功。共同作業の順序は `docs/remaining-work.md` に記録。

GitHubのPR作成許可変更後、[再実行した監視ジョブ](https://github.com/MorikiENG/mnp-norikae-navi/actions/runs/39265795268)が成功し、PR #1の自動更新を確認。先のPR作成権限の保留は解消した。Node33件＋Python6件の[CIも成功](https://github.com/MorikiENG/mnp-norikae-navi/actions/runs/39265771641)。

## 確認版での利用者による操作確認

確認日：2026年10月19日。対象：https://mnp-norikae-navi.pages.dev/

運営者から、タイトル・料金入力フォームが表示され、案内したサンプル計算と内訳・グラフ・CSV保存が問題なく動作したとの回答を得た。サンプルは現在au、月6,000円、10GB、通話なし、2026年10月開始、解約費0円、その他初期値。日本通信SIMみんなのプランの節約額は6/12/24か月で24,360/52,020/107,340円、損益分岐点は1か月目。

これは利用者によるブラウザ確認であり、Codexによる画面の直接観察ではない。端末・OS・ブラウザ種別、狭い画面、スクリーンリーダー、広告ブロッカー、配信ヘッダー、robotsは未確認。CodexからのHTTP検証はCloudflareの403/error code:1010で拒否されたため、確認済みとはしない。

## ワイモバイル追加時の検証

税込基本料3プラン、Lの10分無料・超過通話、S/M従量通話、高速容量の境界、オンライン初期費用3,850円、未確認割引の不算入を検証。Node35件＋Python6件、計41件成功。ビルドも12ブランド21/21プランのカタログ検証に成功。未確認除外のテストは現実のワイモバイルデータに依存せず、テスト内でpendingの状態を作って維持している。

## Cloudflare確認版への反映確認

運営者のCloudflare画面で、配信コミットが48ede54のまま、Gitアカウント切断の表示があった。内容を変えない更新通知用コミット69f6281をmainへpushした後、運営者が新しいデプロイの追加を確認。その後、公開されているワイモバイルページでS/M/Lが「確認済み」になったと回答した。

この結果から、GitHub更新の通知と確認版への反映が復旧し、ワイモバイル追加を含む版が配信されたことを利用者確認として記録する。Cloudflare管理画面やHTTPヘッダーをCodexが直接検証したものではない。正式公開・検索許可・広告配信の承認とは扱わない。
