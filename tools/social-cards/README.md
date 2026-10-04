# 記事ごとの X / Open Graph カード画像

通常のサイトビルドに npm パッケージやフォントは不要です。生成済みの `assets/og/*.png` をコミットし、サイトのビルドが `dist/og/` にコピーします。このフォルダーは、カードを変更するときだけ使う任意の生成ツールです。

## 内容

- 各記事の**画像内**に実際のタイトルをすべて描画。短縮・省略記号なし
- 白地、黒い Noto Sans CJK JP、細い罫線だけの簡潔なレイアウト
- 1200 × 630 px の PNG。左右 84 px の余白
- `social-card-titles.json` の改行が優先。未指定の記事は BudouX の日本語分節＋幅の均等化
- 全31記事の初期設定は意図的な手動改行。画像での文字サイズは 57–78 px
- 不正な HTML は拒否。`<br>` は改行として解釈するだけで、HTML を実行しない
- 長すぎる指定行は文字サイズを調整。最小サイズでも収まらなければ、途中で切らずにエラー
- `title-phrases.json` は HTML 見出しに利用できる、テキストを変えない分節データ

## 改行の指定

プロジェクト直下 `social-card-titles.json` のキーは articles.json の記事 ID です。

```json
{
  "capitalism-socialism": "AIは資本主義と社会主義の\n勝敗を決めるのか",
  "love-or-money": "愛か金かはAIにも決められる。<br>人間に残される仕事"
}
```

`\n`、CRLF、`<br>`、`<br/>`、`<br />` に対応します。大文字の BR も可。タイトル本文・句読点を変えた設定、空行、その他の HTML タグはエラーです。改行前後の空白は整えます。自動処理に戻す場合は、その記事のキーを削除します。手動指定の改行位置を自動処理が勝手に変更することはありません。

改行設定はカード画像専用です。ページの `<title>`、OG/Twitter のタイトル属性、記事本文、アクセシブルなタイトルは通常の文字列のままにしてください。`<br>` をメタタグに入れても画像内の改行にはなりません。

## 再生成

Node.js 20 以上。最初にフォントを用意し、次を実行します。

```sh
cd tools/social-cards
npm ci --ignore-scripts
npm run generate
npm test
```

依存バージョンは package-lock.json で固定しています。通常ビルドはこの `npm ci` を呼びません。

別のパスを使う場合:

```sh
node generate.mjs \
  --articles ../../articles.json \
  --config ../../social-card-titles.json \
  --out ../../assets/og \
  --font-regular /path/to/NotoSansCJK-Regular.ttc \
  --font-bold /path/to/NotoSansCJK-Bold.ttc
```

`CARD_FONT_REGULAR` と `CARD_FONT_BOLD` でも指定できます。出力は 31 記事分＋トップページ用 `index.png`。記事追加は自動検出します。`social-card-manifest.json` と `title-phrases.json` もプロジェクト直下に再生成されます。manifest には改行、文字サイズ、入力フォントと画像の SHA-256 が記録されます。

生成後は PNG・設定・manifest・phrase map をまとめてコミットします。新しい記事を追加した場合、テストの初期31記事/32画像という期待数も更新してください。

## フォントとライセンス

生成に使用したのは **Noto Sans CJK JP Version 2.004** (Regular / Bold) です。公式配布元は [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk/tree/main/Sans)。[Sans/OTC](https://github.com/notofonts/noto-cjk/tree/main/Sans/OTC) の `NotoSansCJK-Regular.ttc` と `NotoSansCJK-Bold.ttc`、または OS の公式 Noto CJK パッケージを利用できます。Debian/Ubuntu 系の標準位置を既定値にしています。その他の OS は引数でパスを指定してください。

同一の画像バイトを再現する場合は、同じ生成パッケージ・実行プラットフォーム・以下のフォントを使用してください。違う版のフォントは文字幅や画像を変えるため、再確認が必要です。

| ファイル | SHA-256 |
| --- | --- |
| NotoSansCJK-Regular.ttc | b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a |
| NotoSansCJK-Bold.ttc | faa5f3656a78b2e2d450d27fe8382c778bc2b6bb5ea29c986664a6a435056ceb |

フォントのメタデータに記載された著作権は © 2014–2021 Adobe。ライセンスは [SIL Open Font License 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)。フォントバイナリを再配布する場合は著作権表示と OFL を同梱してください。このツールはフォントを再配布しません。生成された PNG はフォントソフトウェアそのものではありません。BudouX は Apache-2.0、@napi-rs/canvas は MIT です。各 npm パッケージ内の LICENSE が適用されます。

## 静的 HTML への BudouX の導入

[公式 JavaScript API](https://github.com/google/budoux/blob/main/javascript/README.md) の `loadDefaultJapaneseParser().parse(text)` を、カード再生成時に使用しています。結果の `title-phrases.json` を通常の Node ビルドで読むだけなら、実行時 JS・CDN・有料 API は不要です。

タイトルが一致するレコードの各 `phrases` を HTML エスケープして `<wbr>` で連結してください。`phrases.join('') === title` を検証できます。

```css
.phrase-title {
  word-break: keep-all;
  overflow-wrap: anywhere;
  line-break: strict;
  text-wrap: balance;
}
```

`<wbr>` は文字を挿入せずに改行機会を示せます。全体を `nowrap` にせず、狭い画面では `overflow-wrap:anywhere` を非常時の逃げ道にします。`text-wrap:balance` は補助的な改善で、対応しないブラウザーでも本文が読めるようにします。画像の手動改行は固定キャンバス用なので、そのまま携帯幅の HTML 見出しに強制しないでください。

記事の見出しや短い導入文にも同じ処理を使えます。長文すべてを一括で nowrap 化するのは避けます。コード、pre、URL、数式、既存のリンク・強調・ruby は保持し、通常の日本語禁則とレスポンシブ折り返しを使います。BudouX の HTML 変換 API はサニタイザーではありません。今回のフローではプレーンテキストの分節だけを使います。

## 検証範囲

- 16 テスト: 改行指定の優先、全31記事の手動/自動処理、長文、英数混在、アクセント、括弧・句読点、240 px の狭い領域、長い英単語、HTML 拒否、全文保持
- 全32 PNG のヘッダー、サイズ、manifest の SHA-256 とバイト数を検証
- 実際のピクセルを読み、タイトルが余白内に収まり切れていないことを検証
- 同じ環境で2回再生成し、全画像・manifest が同一であることを確認
- 長い AGI タイトル、Pokémon 混在タイトルなどを 1200 / 600 / 360 px 表示で目視確認

## X 表示に関する注意

2026-10-04 の調査時点で、以前の X 公式カード仕様 URL は [現在の開発者トップ](https://docs.x.com/overview) にリダイレクトされ、最新のカード寸法・ファイル制限をその公式ページから再確認できませんでした。ここでは一般的な互換用キャンバス 1200×630、PNG、1画像5 MB未満、十分な余白を保守的な実装条件としています。X の今日の仕様を新たに確認したという意味ではありません。

記事の公開 HTML は `summary_large_image` と絶対 URL の `og:image` / `twitter:image` を持ち、画像が JavaScript なしで 200 / image/png で取得できることを公開後に確認してください。X 側のキャッシュ、クロール、実際の表示は別の確認事項です。画像内の改行は画像に焼き付けるため固定できますが、X が下に表示するメタデータのタイトル行数は制御対象外です。
