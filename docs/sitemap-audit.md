# サイトマップ生成・配信の調査（2026年10月20日）

Googleでの読み込み失敗の原因は未確定。ローカルの正常なXML生成、通常クライアントからの実配信、Googleからの取得を区別して記録する。

## MNP

従来は1行XML。UTF-8・XML宣言・名前空間・20URLは本番設定を再現したビルドで検証済みで、1行であることを構文エラーの原因とは確認できない。

一方、確認版は公開URLが空のとき、URL0件のurlsetを生成していた。これは生成設計上の弱点であり、確認版をGoogleに送信した場合に関係し得る。公開設定後の実配信XMLをCodexは取得できず、Googleの具体的な失敗と結び付いた証拠はない。

修正：本番だけsitemap.xmlを生成し、確認版では配信しない。本番はURL0件・重複・別ホスト・改行を含む不正パスでビルドを停止。XML宣言を先頭バイトに置き、要素ごとに改行し、URLのXMLエスケープを適用。配信用のContent-Typeと再検証するCache-Controlを明示。これらは防止・点検のための修正で、Google側エラーの解決済みとは扱わない。

## ToolNest（読み取りのみ）

GitHubのsrc/pages/sitemap.xml.ts、robots.txt.ts、astro.config.mjs、site.config.mjsを確認。siteがない場合に0件XMLとなる分岐がある。ただし現在のsite.config.mjsは https://toolnest-8fp.pages.dev を標準URLとし、SITE_URLが明示的に空の場合のみ未設定となるため、現在空XMLを配信しているとは断定できない。Codexから実サイトの取得は403/error code:1010。コード・設定は変更していない。

## 森樹エンジニアリングHP（読み取りのみ）

MorikiENG/MorikiENG.github.ioのサイトマップを確認。実URL https://morikieng.github.io/sitemap.xml をHTTP200・application/xmlで取得できた。1252バイト、XML宣言は先頭、UTF-8、標準名前空間、18URLをElementTreeで解析できた。robots.txtもHTTP200で取得しAllow: /と当該サイトマップ宣言を確認。コード・設定は変更していない。

## 残る確認

Search Consoleに登録した正確なプロパティとサイトマップURL、失敗の詳細、公開URLテストの「ページの取得」を確認する。ブラウザからの取得成功だけをGooglebotの成功と見なさない。Googleに送信したURLや旧デプロイの取り違え、Google固有の取得拒否、一時的な取得失敗などは候補だが、現時点でいずれも確定していない。再送信を繰り返したりセキュリティを一律解除したりする前に証拠を得る。
