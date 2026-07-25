# OGP画像（SNSシェアカード画像）の運用

XなどのSNSでシェアされたときに表示されるカード画像の管理方法。

## 仕組み

- 画像の実体は `og/` 配下（ASCIIファイル名のみ）。
  - `assets/` は過去に `robots.txt` でブロックしていた経緯があり、Xのrobotsキャッシュに引っかかるため使わない。
- カテゴリごとに複数枚を `generateSite.js` の `OG_IMAGE_POOLS` に登録しておき、記事のslugのハッシュで1枚を選ぶ。
  - 同じ記事は毎回同じ画像（生成のたびに変わらない）。
  - 記事が増えるほどカテゴリ内でばらけるので、シェアカードが同じ絵ばかりにならない。
- 写真素材（`assets/` からコピー）と、自作の作図系ビジュアル（SVG由来）が混在している。

## 自作ビジュアルを追加・修正する

作図系の画像は `tools/generateOgSvgs.js` がSVGを組み立て、ブラウザのcanvasでPNG化する。

1. `tools/generateOgSvgs.js` の `VARIANTS` にエントリを追加する（モチーフ関数・アクセント色・ラベルを指定）。
2. SVGを書き出す。

   ```bash
   node tools/generateOgSvgs.js
   ```

   `og-src/*.svg` と `og-src/manifest.json` が更新される。

3. PNG化する。レンダリング用サーバーを起動して `http://localhost:4545/render.html` を開くと、
   全SVGが1200x630のPNGに変換され `og/` に保存される。

   ```bash
   node tools/ogRenderServer.js
   ```

4. `generateSite.js` の `OG_IMAGE_POOLS` に、追加したファイル名を該当カテゴリの配列に足す。
5. サイトを再生成する。

   ```bash
   node generateSite.js
   ```

   プールに存在しないファイル名を書いていると警告が出る。

`og-src/` と `tools/` はビルド時には使われない（生成済みPNGだけをCIが参照する）ため、
GitHub Actionsの自動生成にブラウザは不要。

## 注意

- Xはカードを一定期間キャッシュする。既にシェア済みのURLは、画像を差し替えてもすぐには反映されない。
- 画像はXの上限（5MB）以下に収める。
- ファイル名は必ずASCIIにする（日本語ファイル名はURLエンコードが必要になり事故りやすい）。
