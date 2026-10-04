# konaito.com

konaitoの「文章と記録」。note・X・Qiitaに掲載した文章を本文まで読める静的サイトです。

## 公開と更新

公開先は **GitHub Pagesのみ**、正規URLは **https://konaito.com/** です。
`main` への更新時にGitHub Actionsがビルド・検証し、`dist/` だけをPagesに配信します。
プルリクエストではビルド・検証だけを実行します。

Node.js 20以降があれば、追加パッケージなしで動きます。

```sh
node build.mjs
node validate.mjs
python3 -m http.server 8080 --directory dist
```

- 記事一覧・初回公開日時・掲載元: `articles.json`
- 検証済み本文・目次: `content/*.json`
- 本文取り込み: `scripts/import-article-bodies.py`（Python標準ライブラリのみ）
- 共通レイアウト: `template.html`
- 原文を変えない表示補正: `article-format.mjs`（X本文の改行、文字図、確認済みの数式記法）
- トップページ: `template-index.html`
- スタイル・絞り込み: `assets/style.css` / `assets/script.js`
- 正規URL・検索設定: `site.config.json`
- 記事別カード画像: `assets/og/`
- 画像内のタイトル改行: `social-card-titles.json`
- 日本語見出しの分節: `title-phrases.json`
- カード再生成・テスト: [tools/social-cards/README.md](tools/social-cards/README.md)
- 公開済み出典の検証用一覧: `source-coverage.json`
- 公開ワークフロー: `.github/workflows/pages.yml`

`dist/` は生成物のためコミットしません。`SITE_URL` 環境変数でビルド時の正規URLを上書きできます（HTTPSのオリジンのみ、パスは不可）。
`indexable: false` は検索除外を指示しますが、アクセス制限ではありません。

## 記事データ

31作品・45掲載元（note20、X15、Qiita10）を収録しています。
同内容の別媒体掲載は一つの作品にまとめ、掲載元をnote → X → Qiitaの順で並べます。
同じ媒体で別版として掲載された作品は区別します。

初回公開日時を比較し、最も早い日時を日本時間（Asia/Tokyo）へ変換して一覧の日付に使います。
更新日時を初回公開日には使いません。出典を追加するときは `source-coverage.json` のURL・日時・件数も更新してください。
検証では重複URL・ID、不正日付、日時と日本時間の日付の不一致、確認済み出典との差分、生成HTMLを確認します。

記事の見出しは、このサイトの本文ページ `/articles/<id>/` へつながります。本文の収録対象は31作品です。各本文は、掲載元の優先順位（note → X → Qiita）に沿って選んだ公開版を収録します。別媒体の掲載先も残しています。一覧の紹介文は短い編集要約で、本文の代わりには使いません。

本文はHTMLとして事前生成されるので、JavaScriptを無効にしても読めます。目次、段落、見出し、リスト、引用、コード、表、画像を表示します。埋め込みプレーヤーはリンクに置き換え、第三者の実行スクリプトは読み込みません。

文字による図は改行・空白を保持し、半角と日本語が1:2になる小さな同梱フォントで表示します。画面より広い図やコードは、その枠の中だけ横にスクロールできます。`content/` の取得原文は変更せず、目視確認済みの2図のみ罫線と余白を整えています。原文が変わるとハッシュ照合が外れ、古い図への置換はされません。`tests/article-format.mjs` は全31本で文言・数値・ラベルの保持を検証します。

文字図フォントはNoto Sans Mono / Noto Sans Mono CJK JPの使用文字サブセットです。OFLと著作権表示は `assets/fonts/` に同梱し、外部フォントサービスには接続しません。再生成用の任意スクリプトは `tools/build-diagram-fonts.py`（Python fontToolsとOSの公式Notoフォントが必要）。通常ビルドでは実行不要です。CSSの `size-adjust` でLatin 600-unitを500-unitへ揃え、日本語1000-unitと組み合わせています。

初出の日付と、このサイトへの本文掲載日は区別します。`site.config.json` の `articlePublicationDate` は実際の収録日です。構造化データの `datePublished` にはこのサイトでの掲載日を使い、元記事は `isBasedOn` と掲載元リンクで示します。元媒体のcanonical設定は変更していません。
削除・非公開・下書きの記事や、公開元で確認できない本文履歴は収録対象外です。
追跡Cookie、外部解析スクリプト、アクセス数表示は使用していません。

## 独自ドメイン

GitHubの Settings → Pages で Source を **GitHub Actions**、Custom domain を **konaito.com** に設定します。
Actions配信ではリポジトリの `CNAME` ファイルは不要です。

DNSは現在のレコードを確認・保管したうえで、Web配信に関係するレコードだけを変更します。
MX、TXT、他のサブドメインやネームサーバーは変更しません。
GitHubへ独自ドメインを登録してからDNSを切り替えてください。

- apex（`@`）のA: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- IPv6を使う場合のAAAA: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
- `www` のCNAME: `konaito.github.io`（リポジトリ名を含めない）

DNSプロキシを使う場合は証明書・リダイレクトに影響するため、切り替え前に確認してください。
DNS検証と証明書発行が完了したらHTTPSを有効化し、ページ・CSS・JavaScriptの取得を確認します。

[GitHubの独自ドメイン設定](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## 検索と共有

- 各記事に固有のtitle、description、HTTPS canonical、Open Graph / Xカード情報を生成します
- JSON-LDはWebSite・Person・CollectionPage・Article・BreadcrumbListをページの実体に合わせて出力します
- `sitemap.xml` にはトップと31本文の正規URLのみを収録し、`robots.txt` から案内します
- 日付を新しく見せるための `lastmod` は出力しません
- `404.html` はnoindex。GitHub Pagesが見つからないURLに404のHTTPステータスで配信します
- `indexable: false` では全ページをnoindexにし、サイトマップは空にします。robots.txtはクロールを許可し、検索エンジンがnoindexを読めるようにします

OG/Xカードは1200×630の画像内にタイトルを描画します。画像専用の改行指定（\n / <br>）とBudouXによる分節を使い、メタタグ内に改行は入れません。公開ページの見出しには同じ分節データを静的な `<wbr>` として使います。ブラウザへ日本語解析ライブラリや外部フォントを送る必要はありません。

Search Consoleに送信するURLは https://konaito.com/sitemap.xml です。サイトマップ送信や構造化データは、登録や順位を保証しません。

## 本文の更新手順

1. 公開元で全文・公開日・画像を確認し、既存の作品IDに紐付けます
2. 本文だけのHTMLを、`articles` 配列内の `id`、`sourceUrl`、`sourceTitle`、`html`、`extractedAt`、`notes` として保存します
3. `python3 scripts/import-article-bodies.py export.json` で許可したHTML要素だけを取り込み、目次を作ります。`content/` のJSON配列を合成して読み込みます。再取り込み時は作品ごとのファイルに整理されます
4. `python3 tests/import-article-bodies.py` と `node build.mjs && node validate.mjs` を実行します
5. 原文と本文、出典リンク、モバイル表示を確認して公開します

抽出の不足や取得できない本文を、要約・生成文で埋めないでください。設定で収録対象となった全作品の検証済み本文が揃わなければビルドは失敗します。

`externalOnlyArticles` に指定した作品は、一覧に元の掲載先だけを残します。本文を公開データに含めると検証が失敗します。現在は全31作品を著者の方針に沿って全文無料で収録しています。収録対象を変える前に著者の公開方針を確認してください。

設計の参照資料: [Google SEOスターターガイド](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)、[サイトマップ](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)、[Article構造化データ](https://developers.google.com/search/docs/appearance/structured-data/article)
