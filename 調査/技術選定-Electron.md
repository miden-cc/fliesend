<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Electronの開発環境セットアップとネイティブ移行時のコード再利用について

ユーザーさんの理解は正確です。Electronは最初からデスクトップアプリを作るツールであり、後からネイティブで実装し直す場合、コード再利用には一定の制約があります。以下、2つの質問に詳しくお答えします。

## 1. Electronの開発環境セットアップ方法

### 前提条件

macOSでElectron開発を始めるには、まず**Node.js**と**npm**（Node Package Manager）のインストールが必要です。[^1_1][^1_2][^1_3]

### Step 1: Homebrewのインストール（推奨）

Homebrewはmacの必須パッケージマネージャーです。[^1_4][^1_5]

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

インストール後、PATHを通します:[^1_6][^1_5]

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```


### Step 2: Node.jsのインストール

Homebrewを使った方法が最も簡単です:[^1_7][^1_8]

```bash
brew install node
```

インストール確認:[^1_9][^1_10]

```bash
node -v
npm -v
```


### Step 3: Electronプロジェクトの作成

プロジェクトフォルダを作成し、初期化します:[^1_2][^1_11][^1_1]

```bash
mkdir my-electron-app
cd my-electron-app
npm init -y
```


### Step 4: Electronのインストール

プロジェクトにElectronを開発依存関係として追加します:[^1_11][^1_2]

```bash
npm install electron --save-dev
```


### Step 5: 基本ファイルの作成

**package.json**を編集し、メインファイルとスタートスクリプトを設定します:[^1_1][^1_2]

```json
{
  "name": "my-electron-app",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^35.0.0"
  }
}
```

**main.js**（メインプロセス）を作成します:[^1_12][^1_2][^1_1]

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  mainWindow.loadFile('index.html');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

**index.html**を作成します:[^1_2][^1_1]

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Electron App</title>
</head>
<body>
  <h1>Hello Electron!</h1>
  <p>これは最初のElectronアプリです</p>
</body>
</html>
```


### Step 6: アプリの起動

```bash
npm start
```


### アプリのビルドと配布（オプション）

本格的な配布には**electron-builder**を使用します:[^1_13][^1_14]

```bash
npm install electron-builder --save-dev
```

**package.json**にビルドスクリプトを追加:[^1_13]

```json
{
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.example.myapp",
    "mac": {
      "target": "dmg"
    }
  }
}
```

ビルド実行:[^1_13]

```bash
npm run dist
```

macOSで配布する場合、コード署名と公証が必要になります。[^1_15][^1_16][^1_17]

## 2. ネイティブで作り直す場合、Electronのコードは再利用できるか？

### 結論：一部のみ可能だが、大半は書き直しが必要

Electronからネイティブ（Swift/SwiftUI）への移行では、**コードの再利用性は限定的**です。[^1_18][^1_19][^1_20]

### 再利用可能な部分（約30-40%）

**ビジネスロジック**は条件付きで再利用可能です:[^1_19][^1_20]

- データモデル
- バリデーションロジック
- アルゴリズム
- API通信ロジック（REST/GraphQL）

ただし、JavaScriptからSwiftへの**手動移植**が必要です。[^1_20][^1_21][^1_19]

例：バリデーションロジックの移行[^1_20]

**JavaScript（Electron）**:

```javascript
function isValidEmail(email) {
  const regex = /^[A-Z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,64}$/i;
  return regex.test(email);
}
```

**Swift（ネイティブ）**:

```swift
func isValidEmail(_ email: String) -> Bool {
  let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
  return NSPredicate(format: "SELF MATCHES %@", emailRegex)
    .evaluate(with: email)
}
```


### 再利用不可能な部分（約60-70%）

以下は完全に書き直しが必要です:[^1_22][^1_23][^1_18]

1. **UIレイヤー**：HTML/CSSからSwiftUI/UIKitへ完全移行
2. **プロセス間通信（IPC）**：Electronのメイン/レンダラー通信はネイティブでは不要
3. **Electron固有API**：ファイルシステム、ネイティブメニュー、通知など
4. **パッケージ依存関係**：npmパッケージはSwift Packageに置き換え

### アーキテクチャレベルの違い

**Electron**:[^1_24][^1_25]

- メインプロセス（Node.js）+ レンダラープロセス（Chromium）
- IPCによる通信
- Web技術スタック

**ネイティブ（Swift）**:

- 単一プロセスアーキテクチャ
- MVC/MVVM/MVPパターン
- Cocoa/SwiftUIフレームワーク


### 移行時の現実的な戦略

**段階的移行アプローチ**:[^1_23][^1_18][^1_19]

1. **設計書の作成**：Electronアプリの機能仕様を文書化
2. **ビジネスロジックの抽出**：プラットフォーム非依存な部分を特定[^1_19]
3. **Swift版の設計**：ネイティブアーキテクチャで再設計
4. **ロジックの移植**：JavaScriptからSwiftへ手動で翻訳[^1_20]
5. **UIの再構築**：SwiftUIで全面的に作り直し
6. **並行運用期間**：Electron版とネイティブ版を併存させる[^1_23]

### 開発コストの比較

| 段階 | Electron | ネイティブ移行 |
| :-- | :-- | :-- |
| MVP開発 | 1-2ヶ月[^1_26][^1_27] | - |
| 全面書き直し | - | 3-6ヶ月[^1_18] |
| 合計工数 | 1-2人月 | +3-6人月[^1_23] |

### MVPとしてのElectronの価値

**Electronが最適なケース**:[^1_28][^1_27][^1_23]

- アイデア検証が最優先
- 開発リソースが限られている
- 短期間でのリリースが必要（1-3ヶ月）[^1_26][^1_27]
- クロスプラットフォーム対応が必要

**ネイティブ移行を検討すべきタイミング**:[^1_28][^1_23]

- ユーザーからパフォーマンスへの不満が出る
- アプリサイズ（100MB+）が問題になる[^1_28]
- ネイティブ機能への深いアクセスが必要
- 資金調達が完了し、本格開発の準備が整った


### 実践的なアドバイス

Electronでの開発時に**将来の移行を見据えた設計**をしておくと、移行コストを削減できます:[^1_22][^1_19]

1. **ビジネスロジックとUIの分離**を徹底
2. **API通信層を独立したモジュール**に
3. **データモデルをJSON/TypeScript型定義**で明確化
4. **コンポーネント設計書を作成**し、機能の責任を明確に

## まとめ

1. **Electronの開発環境**は、Homebrew → Node.js → npm → Electronの順でセットアップ
2. **コードの再利用**は30-40%程度（ビジネスロジックのみ）
3. **UI層は完全に書き直し**が必要
4. **MVP段階ではElectronが最適**で、検証後に必要に応じてネイティブ移行を検討

Electronは「アイデアを素早く形にする調理器具」として優秀です。将来的にネイティブへ移行する場合でも、MVPで得られるユーザーフィードバックの価値は計り知れません。まずはElectronで確実な第一歩を踏み出すことをお勧めします。[^1_27][^1_29][^1_26]
<span style="display:none">[^1_30][^1_31][^1_32][^1_33][^1_34][^1_35][^1_36][^1_37][^1_38][^1_39][^1_40][^1_41][^1_42][^1_43][^1_44][^1_45][^1_46][^1_47][^1_48][^1_49][^1_50][^1_51][^1_52][^1_53][^1_54][^1_55][^1_56][^1_57][^1_58][^1_59][^1_60][^1_61][^1_62][^1_63][^1_64][^1_65][^1_66][^1_67][^1_68][^1_69][^1_70]</span>

<div align="center">⁂</div>

[^1_1]: https://electronjs.org/ja/docs/latest/tutorial/tutorial-first-app

[^1_2]: https://qiita.com/tinymouse/items/6d111f714db061af119c

[^1_3]: https://electronjs.org/ja/docs/latest/tutorial/tutorial-prerequisites

[^1_4]: https://iuse.co.jp/blog/macで学べるプログラミング言語と最適な開発環境設定ガイド

[^1_5]: https://techblog.sunl.jp/mac-setup/

[^1_6]: https://note.com/iluvc0ffee/n/n46de461f2aec

[^1_7]: https://js2iiu.com/2025/05/13/mac-node-js-npm-install/

[^1_8]: https://mikaduki.info/dev-env/mac-node-npm-install/

[^1_9]: https://www.eisbahn.jp/yoichiro/2025/09/install_nodejs_on_macos.html

[^1_10]: https://prog-8.com/docs/nodejs-env

[^1_11]: https://ics.media/entry/7298/

[^1_12]: https://unikoukokun.jp/n/n5f1319e2bc05

[^1_13]: https://hiramame-gclab.com/electron-builder_install/

[^1_14]: https://t-cr.jp/article/hme1iv9garrog8j

[^1_15]: https://zenn.dev/portalkeyinc/articles/6e59c5cc3ac7aa

[^1_16]: https://www.issoh.co.jp/tech/details/6874/

[^1_17]: https://zenn.dev/minamiso/articles/568c8110a46901

[^1_18]: https://www.graphon.com/ja/blog/rewriting-windows-applications

[^1_19]: https://it-araiguma.com/swift-sdk-android-practical-guide/

[^1_20]: https://tech.every.tv/entry/2025/10/31/151237

[^1_21]: https://web.dev/case-studies/goodnotes?hl=ja

[^1_22]: https://websystem.tokyo/capacitor-development/

[^1_23]: https://acro-engineer.hatenablog.com/entry/2018/12/24/215009

[^1_24]: https://www.issoh.co.jp/tech/details/3322/

[^1_25]: https://www.issoh.co.jp/tech/details/3640/

[^1_26]: https://wakka-inc.com/blog/16393/

[^1_27]: https://fintan.jp/page/10596/

[^1_28]: https://blog.capilano-fw.com/?p=352

[^1_29]: https://nocoderi.co.jp/2025/05/02/mvp開発とプロトタイプの違いとは？混同しがちな/

[^1_30]: https://www.reddit.com/r/reactnative/comments/1g4zb35/would_you_recommend_starting_a_career_in_app/

[^1_31]: https://note.com/rapid_phlox5979/n/nf743b879060e

[^1_32]: https://www.issoh.co.jp/tech/details/9563/

[^1_33]: https://electronjs.org/ja/docs/latest/

[^1_34]: https://capacitorjs.jp/docs/main/deployment/desktop-app

[^1_35]: https://note.com/newnakashima/n/nbc388c096a7c

[^1_36]: https://zenn.dev/ncdc/articles/b57fa8e56f49f1

[^1_37]: https://www.fsi-embedded.jp/solutions/cross-platform/what-is-crossplatform/

[^1_38]: https://qiita.com/umamichi/items/6ce4f46c1458e89c4cfc

[^1_39]: https://www.reddit.com/r/electronjs/comments/1lrvtp7/best_way_to_start_an_electron_app_2025/

[^1_40]: https://pentagon.tokyo/app/5269/

[^1_41]: https://note.com/rapid_phlox5979/n/n2cc2708d9f31

[^1_42]: https://cn.teldevice.co.jp/column/30540/

[^1_43]: https://zenn.dev/timetree/articles/bfec6d4de0bfc3

[^1_44]: https://www.issoh.co.jp/tech/details/9593/

[^1_45]: https://staff.persol-xtech.co.jp/hatalabo/it_engineer/641.html

[^1_46]: https://note.com/rdlabo/n/na41578be1871

[^1_47]: https://ittrip.xyz/javascript/javascript-swift-data-integration

[^1_48]: https://www.reddit.com/r/androiddev/comments/z2y3ia/best_way_to_move_from_web_app_to_mobile_app/

[^1_49]: https://www.appbuilder.dev/ja/blog/desktop-app-to-a-web-app

[^1_50]: https://qiita.com/mitsuharu_e/items/c2f7893a2c974dd5fc77

[^1_51]: https://www.reddit.com/r/FlutterDev/comments/1gqf1k1/help_me_choose_the_right_framework_for/

[^1_52]: https://www.impl.co.jp/whitepaper/cross-platform/

[^1_53]: https://qiita.com/naoki-atjp/items/f27b8e7c10e6c793055c

[^1_54]: https://reservoir.design/macos-homebrew-buildenv1/

[^1_55]: https://developer.mamezou-tech.com/blogs/2023/05/22/electron-vite/

[^1_56]: https://python-engineer.co.jp/python-install-mac/

[^1_57]: https://offers.jp/media/programming/a_3986

[^1_58]: https://www.cascio.jp/2025/08/mac-nodejs-npm.html

[^1_59]: https://qiita.com/shimada_slj/items/f4f27141129e0e5e482a

[^1_60]: https://zenn.dev/karaage0703/articles/a1ee72f22882e9

[^1_61]: https://electronjs.org/ja/docs/latest/tutorial/mac-app-store-submission-guide

[^1_62]: https://zenn.dev/maru_contents/articles/need_for_electron

[^1_63]: https://qiita.com/agt/items/ceec674858447d225929

[^1_64]: https://tech.layerx.co.jp/entry/2025/09/08/142149

[^1_65]: https://www.reddit.com/r/reactnative/comments/15kuekh/react_native_vs_electron_vs_capacitor_in_2023/

[^1_66]: https://blogs.embarcadero.com/ja/visually-designing-apps-in-delphi-delivers-up-to-5x-productivity-gains-over-wpf-and-electron-ja/

[^1_67]: https://b.hatena.ne.jp/entry/s/zenn.dev/minamiso/articles/568c8110a46901

[^1_68]: https://qiita.com/keko/items/fbec79179cd01603efa4

[^1_69]: https://www.reddit.com/r/UXDesign/comments/z8qggg/how_much_time_does_wireframing_take_to_you_for/

[^1_70]: https://zenn.dev/aktriver/articles/2021-06-electron-embedded

