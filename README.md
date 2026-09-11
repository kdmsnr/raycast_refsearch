# レファ協検索 for Raycast

[レファレンス協同データベース API 2.0](https://crd.ndl.go.jp/jp/help/general/help_07.html)で検索するRaycast拡張。APIキー不要。

## 導入

macOS・Raycast・Node.js 22.22.2以降が必要です。
リポジトリを取得し、依存パッケージのインストールとビルドを行います。

```sh
git clone https://github.com/kdmsnr/raycast_refsearch.git
cd raycast_refsearch
npm ci
npm run build
```

1. Raycastで **Import Extension** コマンドを開きます。
2. 取得した `raycast_refsearch` ディレクトリ（`package.json` があるディレクトリ）を指定します。
3. Raycastで **refsearch** または **refsearch-adv** を開きます。

## 使い方

- **refsearch**：キーワードで検索。初期設定はAND検索・適合度順。
- **refsearch-adv**：質問・回答・提供館などを指定し、⌘Enterで検索。たとえば「質問：本」「回答：村上春樹」を入力すると、両方を満たす事例を探します。

レファレンス事例・調べ方マニュアル・特別コレクション・参加館に対応。結果をプレビューし、末尾で50件ずつ追加取得します。

| 操作           | キー  |
| -------------- | ----- |
| 元ページを開く | Enter |
| 詳細を読む     | ⌘O    |
| URLをコピー    | ⌘C    |
| 並び順を変更   | ⌘S    |
| 検索条件を編集 | ⌘E    |
| 再検索         | ⌘R    |

## 開発

```sh
npm run dev       # 開発モードで読み込み、変更を反映
npm test          # オフラインテスト
npm run lint      # コード・書式の確認
npm run build     # ビルドのみ
npm run test:api  # 実APIの疎通確認
```

UIテストは実行せず、IME・入力ソースは変更しません。

## 利用条件

APIは非営利目的で利用できます。各データの著作権は原則として提供館に帰属します。[提供元の利用条件](https://crd.ndl.go.jp/jp/help/general/help_07.html)に従ってください。ソースコードはMITライセンスです。
