# konaito.com

konaitoの「文章と記録」。note・X・Qiitaに掲載した文章をまとめた静的サイトです。

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

- 記事一覧: `articles.json`
- 見出し・固定の導線: `template.html`
- スタイル・絞り込み: `assets/style.css` / `assets/script.js`
- 正規URL・検索設定: `site.config.json`
- 公開済み出典の検証用一覧: `source-coverage.json`
- 公開ワークフロー: `.github/workflows/pages.yml`

`dist/` は生成物のためコミットしません。`SITE_URL` 環境変数でビルド時の正規URLを上書きできます。
`indexable: false` は検索除外を指示しますが、アクセス制限ではありません。

## 記事データ

31作品・45掲載元（note20、X15、Qiita10）を収録しています。
同内容の別媒体掲載は一つの作品にまとめ、掲載元をnote → X → Qiitaの順で並べます。
同じ媒体で別版として掲載された作品は区別します。

初回公開日時を比較し、最も早い日時を日本時間（Asia/Tokyo）へ変換して一覧の日付に使います。
更新日時を初回公開日には使いません。出典を追加するときは `source-coverage.json` のURL・日時・件数も更新してください。
検証では重複URL・ID、不正日付、日時と日本時間の日付の不一致、確認済み出典との差分、生成HTMLを確認します。

紹介文は短い要約です。本文と既存画像は転載せず、各掲載元へリンクしています。
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
