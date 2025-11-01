# fließend - 開発ガイド

## 環境構築

### 必要な環境

- **Node.js**: v18.x 以上
- **npm**: v9.x 以上
- **OS**: macOS / Windows / Linux

### 初期セットアップ

1. **依存関係のインストール**

```bash
npm install
```

2. **開発モードで起動**

```bash
npm run dev
```

開発者ツールが自動的に開き、ホットリロードが有効になります。

3. **通常モードで起動**

```bash
npm start
```

## プロジェクト構造

```
fliesend/
├── src/
│   ├── main.js          # メインプロセス（Electronのエントリーポイント）
│   └── preload.js       # プリロードスクリプト（セキュアなAPI提供）
├── public/
│   ├── index.html       # UIのHTML
│   ├── styles.css       # スタイルシート
│   └── renderer.js      # レンダラープロセスのロジック
├── package.json         # プロジェクト設定
└── README.md            # プロジェクト概要
```

## 開発の流れ

### Phase 0: 環境セットアップ（現在）✓

- [x] Electronプロジェクトの初期化
- [x] 基本的なファイル構造の作成
- [x] 開発環境の整備（ホットリロード設定）
- [x] 基本UIの実装

### Phase 1: 基本表示機能（次のステップ）

- [ ] フォルダ選択ダイアログの実装
- [ ] フォルダツリーの読み込み
- [ ] ツリーの表示

## トラブルシューティング

### Electronのインストールに失敗する場合

環境によってはElectronのダウンロードに制限がある場合があります。

**解決策1: プロキシ設定**
```bash
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
```

**解決策2: 別のレジストリを使用**
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

**解決策3: Electronをグローバルにインストール**
```bash
npm install -g electron@27.0.0
```

### ホットリロードが動作しない場合

`electron-reload`のインストールに失敗している可能性があります。
一度アプリを閉じて、再度`npm run dev`で起動してください。

## 開発Tips

### デバッグ

- **開発者ツール**: `npm run dev`で自動的に開きます
- **コンソールログ**: メインプロセスのログはターミナルに表示されます
- **レンダラープロセスのログ**: 開発者ツールのコンソールに表示されます

### コードの変更

- `src/main.js`: メインプロセスのコードを変更した場合、アプリの再起動が必要です
- `public/*`: UI関連のファイルを変更した場合、ホットリロードで自動的に反映されます

## 次のステップ

現在はPhase 0が完了しています。次はPhase 1「基本表示機能」の実装に進みます。

詳細は`TODO.md`を参照してください。
