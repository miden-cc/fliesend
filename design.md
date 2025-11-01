# fließend - システム設計書

**Version:** 0.1.0 (Draft)
**Last Updated:** 2025-11-01
**対象フェーズ:** MVP（Minimum Viable Product）

---

## 目次

1. [設計方針](#1-設計方針)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [データモデル](#3-データモデル)
4. [コンポーネント設計](#4-コンポーネント設計)
5. [双方向同期の実装](#5-双方向同期の実装)
6. [状態管理](#6-状態管理)
7. [ファイルシステム操作](#7-ファイルシステム操作)
8. [エラーハンドリング](#8-エラーハンドリング)
9. [パフォーマンス最適化](#9-パフォーマンス最適化)
10. [セキュリティ考慮事項](#10-セキュリティ考慮事項)

---

## 1. 設計方針

### 1.1 核心原則

**シンプリシティ第一**
- MVPでは最小限の機能のみ実装
- 複雑な抽象化は避け、直接的な実装を優先
- 将来の拡張性より、現在の理解しやすさを重視

**即座のフィードバック**
- ユーザーの操作は即座にUIに反映
- ファイルシステムへの書き込みは非同期だが、ユーザーには同期的に見える

**データの整合性**
- ファイルシステムが唯一の真実の源（Single Source of Truth）
- UIはファイルシステムの「ビュー」に過ぎない
- 衝突時はファイルシステムの状態を優先

### 1.2 技術的制約

**対象プラットフォーム（MVP）**
- macOS 12.0以降（開発者の環境）
- 将来的にWindows/Linux対応を検討

**パフォーマンス目標**
- 100ファイル程度で快適に動作
- ノード操作からUI更新まで100ms以内
- ファイル監視の反映は500ms以内

---

## 2. システムアーキテクチャ

### 2.1 全体構造（Electron版）

```
┌──────────────────────────────────────────────────────────┐
│                    Renderer Process                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 UI Layer (HTML/CSS/JS)              │  │
│  │  ┌──────────────┐  ┌──────────────┐                │  │
│  │  │ OutlineTree  │  │  FileViewer  │                │  │
│  │  │  Component   │  │  Component   │                │  │
│  │  └──────┬───────┘  └──────┬───────┘                │  │
│  └─────────┼──────────────────┼────────────────────────┘  │
│            │                  │                            │
│  ┌─────────▼──────────────────▼────────────────────────┐  │
│  │             State Manager (TreeState)               │  │
│  │  - Current tree structure                           │  │
│  │  - Selection state                                  │  │
│  │  - Expansion state                                  │  │
│  └─────────┬───────────────────────────────────────────┘  │
└────────────┼──────────────────────────────────────────────┘
             │ IPC (invoke/handle)
┌────────────▼──────────────────────────────────────────────┐
│                    Main Process                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              FileSystemManager                      │  │
│  │  ┌──────────────┐  ┌──────────────┐                │  │
│  │  │ FSOperations │  │  FileWatcher │                │  │
│  │  │  (CRUD)      │  │  (chokidar)  │                │  │
│  │  └──────┬───────┘  └──────┬───────┘                │  │
│  └─────────┼──────────────────┼────────────────────────┘  │
└────────────┼──────────────────┼───────────────────────────┘
             │                  │
┌────────────▼──────────────────▼───────────────────────────┐
│                 Local File System                         │
│  - Folders & Files                                        │
│  - .outline-meta/ (future: metadata storage)              │
└───────────────────────────────────────────────────────────┘
```

### 2.2 プロセス分離の理由

**Main Process (Node.js)**
- ファイルシステムへの完全なアクセス権限
- セキュリティサンドボックス外で動作
- ファイル監視の常駐プロセス

**Renderer Process (Chromium)**
- ユーザーインターフェースの描画
- セキュリティサンドボックス内で動作
- ファイルシステムへの直接アクセスは制限

### 2.3 IPC通信設計

**基本方針:**
- `ipcRenderer.invoke()` / `ipcMain.handle()` パターンを使用
- すべてのファイル操作は非同期
- エラーはPromise rejectで返す

**主要なIPCチャネル:**

```javascript
// Main → Renderer (イベント通知)
- 'fs:changed' : ファイルシステム変更通知
- 'fs:error'   : エラー通知

// Renderer → Main (操作要求)
- 'fs:readTree'    : ツリー構造の読み込み
- 'fs:moveNode'    : ノードの移動
- 'fs:createNode'  : ノードの作成
- 'fs:deleteNode'  : ノードの削除
- 'fs:renameNode'  : ノード名変更
```

---

## 3. データモデル

### 3.1 TreeNode（コアデータ構造）

```typescript
interface TreeNode {
  // 基本プロパティ
  id: string;              // UUID v4（アプリ内での一意識別子）
  name: string;            // 表示名（ファイル/フォルダ名）
  path: string;            // 絶対パス
  type: 'file' | 'folder'; // ノードタイプ

  // 階層構造
  children?: TreeNode[];   // 子ノード（フォルダの場合のみ）
  parent?: string;         // 親ノードのID（null = ルート）

  // UI状態（Renderer側で管理）
  isExpanded?: boolean;    // 展開状態
  isSelected?: boolean;    // 選択状態

  // ファイルシステム情報
  stats: {
    size: number;          // ファイルサイズ（bytes）
    created: Date;         // 作成日時
    modified: Date;        // 更新日時
    isReadOnly: boolean;   // 読み取り専用フラグ
  };
}
```

### 3.2 TreeState（アプリケーション状態）

```typescript
interface TreeState {
  // ツリーデータ
  rootPath: string;           // ルートフォルダのパス
  nodes: Map<string, TreeNode>; // ID → Node のマップ
  rootNodeIds: string[];      // ルートレベルのノードID配列

  // UI状態
  selectedNodeId: string | null;  // 選択中のノードID
  expandedNodeIds: Set<string>;   // 展開されているノードIDのセット

  // 操作状態
  isLoading: boolean;         // ローディング中フラグ
  lastError: Error | null;    // 最後のエラー
}
```

### 3.3 データフロー

```
User Action
    ↓
UI Event Handler
    ↓
State Update (optimistic)
    ↓
IPC Request → Main Process
    ↓
File System Operation
    ↓ (success)
File Watcher Notification
    ↓
IPC Event → Renderer
    ↓
State Reconciliation
    ↓
UI Re-render
```

**楽観的更新（Optimistic Update）:**
- ユーザー操作時、即座にUIを更新
- バックグラウンドでファイルシステムへ書き込み
- 失敗時はロールバックしてエラー表示

---

## 4. コンポーネント設計

### 4.1 Rendererプロセス（UI層）

#### 4.1.1 OutlineTreeComponent

**責務:**
- ツリー構造の描画
- キーボード/マウスイベントのハンドリング
- インデント操作（Tab/Shift+Tab）の処理

**主要メソッド:**

```javascript
class OutlineTreeComponent {
  constructor(container, state) { }

  // レンダリング
  render() { }
  renderNode(node, level) { }

  // イベントハンドラー
  handleKeyDown(event) { }
  handleNodeClick(nodeId) { }
  handleNodeDoubleClick(nodeId) { }

  // 操作
  moveNodeUp(nodeId) { }      // Shift+Tab
  moveNodeDown(nodeId) { }    // Tab
  toggleExpansion(nodeId) { }
}
```

#### 4.1.2 StateManager

**責務:**
- アプリケーション状態の一元管理
- 状態変更の検知とUI更新のトリガー
- IPCとの橋渡し

**主要メソッド:**

```javascript
class StateManager {
  constructor() {
    this.state = new TreeState();
    this.listeners = [];
  }

  // 状態更新
  setRootPath(path) { }
  updateTree(nodes) { }
  selectNode(nodeId) { }
  toggleExpansion(nodeId) { }

  // 購読パターン
  subscribe(listener) { }
  notify() { }

  // IPC連携
  async loadTree(path) { }
  async moveNode(nodeId, newParentId, index) { }
}
```

### 4.2 Mainプロセス（ファイルシステム層）

#### 4.2.1 FileSystemManager

**責務:**
- ファイルシステム操作のAPI提供
- ファイル監視の管理
- エラーハンドリング

**主要メソッド:**

```javascript
class FileSystemManager {
  constructor() {
    this.watcher = null;
    this.rootPath = null;
  }

  // ツリー操作
  async readTree(path) { }
  async moveNode(sourcePath, destPath) { }
  async createNode(parentPath, name, type) { }
  async deleteNode(path) { }
  async renameNode(path, newName) { }

  // ファイル監視
  startWatching(path, callback) { }
  stopWatching() { }

  // ヘルパー
  buildTreeFromPath(path) { }
  validatePath(path) { }
}
```

#### 4.2.2 FileWatcher

**責務:**
- ファイルシステムの変更を監視
- 変更イベントをRenderer側へ通知
- デバウンス処理（連続変更の抑制）

**実装例（chokidar使用）:**

```javascript
class FileWatcher {
  constructor(fsManager) {
    this.watcher = null;
    this.debounceTimer = null;
  }

  watch(path, options = {}) {
    this.watcher = chokidar.watch(path, {
      ignored: /(^|[\/\\])\../, // 隠しファイルを除外
      persistent: true,
      ignoreInitial: true,
      depth: undefined,         // 無制限の深さ
    });

    this.watcher
      .on('add', this.handleAdd.bind(this))
      .on('unlink', this.handleUnlink.bind(this))
      .on('addDir', this.handleAddDir.bind(this))
      .on('unlinkDir', this.handleUnlinkDir.bind(this))
      .on('change', this.handleChange.bind(this));
  }

  handleAdd(path) {
    this.debounceNotify('add', path);
  }

  debounceNotify(event, path) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      // Rendererへ通知
      BrowserWindow.getAllWindows()[0].webContents.send('fs:changed', {
        event,
        path
      });
    }, 300); // 300msのデバウンス
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
```

---

## 5. 双方向同期の実装

### 5.1 同期の基本フロー

```
┌─────────────────┐         ┌─────────────────┐
│   UI操作        │         │ FS外部変更      │
│  (Tab/名前変更) │         │ (他アプリ編集)  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│ Optimistic      │         │  FileWatcher    │
│ UI Update       │         │  Notification   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           │
┌─────────────────┐                 │
│  IPC Request    │                 │
└────────┬────────┘                 │
         │                           │
         ▼                           │
┌─────────────────┐                 │
│ FS Operation    │                 │
│  (fs.rename,    │                 │
│   fs.mkdir...)  │                 │
└────────┬────────┘                 │
         │                           │
         └───────────┬───────────────┘
                     ▼
         ┌─────────────────────┐
         │  State              │
         │  Reconciliation     │
         └───────────┬─────────┘
                     ▼
         ┌─────────────────────┐
         │   UI Re-render      │
         └─────────────────────┘
```

### 5.2 衝突解決戦略

**基本方針:**
- **ファイルシステムが常に正**
- UI状態はファイルシステムの変更を追従

**衝突ケース:**

| ケース | UI操作 | FS変更 | 解決方法 |
|--------|--------|--------|----------|
| 1 | ノードA移動中 | 外部でノードA削除 | 操作をキャンセル、エラー表示 |
| 2 | ノードA移動中 | 外部でノードA移動 | UI操作を優先（後勝ち） |
| 3 | ノードA名変更中 | 外部でノードA名変更 | 外部変更を優先、UI操作は失敗 |
| 4 | - | 外部で大量ファイル追加 | デバウンス後、ツリー全体を再構築 |

**実装例:**

```javascript
// 楽観的更新 + ロールバック
async function moveNodeOptimistic(nodeId, newParentId) {
  const originalState = cloneState(state);

  try {
    // 1. 即座にUIを更新
    updateUIState(nodeId, newParentId);

    // 2. ファイルシステムへの書き込み
    const node = state.nodes.get(nodeId);
    const newParent = state.nodes.get(newParentId);
    await ipcRenderer.invoke('fs:moveNode',
      node.path,
      newParent.path
    );

    // 3. 成功（FileWatcherが変更を検知してツリー更新）
  } catch (error) {
    // 4. 失敗時はロールバック
    restoreState(originalState);
    showError(`移動に失敗しました: ${error.message}`);
  }
}
```

### 5.3 ファイル監視の最適化

**除外パターン:**
```javascript
const IGNORE_PATTERNS = [
  /(^|[\/\\])\../,           // 隠しファイル (.git, .DS_Store等)
  /node_modules/,            // node_modules
  /\.outline-meta/,          // メタデータフォルダ（将来）
  /\.(tmp|temp|swp|swo)$/,   // 一時ファイル
];
```

**デバウンス設定:**
- 単一ファイル変更: 300ms
- 大量変更（>10ファイル）: 1000ms

---

## 6. 状態管理

### 6.1 状態の分類

**永続化不要な状態（Rendererメモリ）:**
- 現在のツリー構造
- 選択中のノード
- 展開されているノード
- UI表示状態

**永続化が必要な状態（将来実装）:**
- 最後に開いたフォルダパス
- ウィンドウサイズ・位置
- ユーザー設定

### 6.2 状態更新のパターン

**イミュータブル更新:**
```javascript
// 悪い例（ミュータブル）
state.nodes.get(nodeId).isExpanded = true;

// 良い例（イミュータブル）
const updatedNode = { ...state.nodes.get(nodeId), isExpanded: true };
state.nodes.set(nodeId, updatedNode);
notifyListeners();
```

**バッチ更新:**
```javascript
class StateManager {
  constructor() {
    this.pendingUpdates = [];
    this.updateScheduled = false;
  }

  scheduleUpdate(updateFn) {
    this.pendingUpdates.push(updateFn);

    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.applyBatchUpdates();
      });
    }
  }

  applyBatchUpdates() {
    this.pendingUpdates.forEach(fn => fn(this.state));
    this.pendingUpdates = [];
    this.updateScheduled = false;
    this.notifyListeners();
  }
}
```

---

## 7. ファイルシステム操作

### 7.1 ノード移動の実装

**アルゴリズム（Tab/Shift+Tab）:**

```javascript
// Tab: 選択ノードを一つ上の兄弟の子にする
function moveNodeDown(nodeId) {
  const node = state.nodes.get(nodeId);
  const siblings = getSiblings(node);
  const currentIndex = siblings.indexOf(node);

  if (currentIndex === 0) {
    // 最初の兄弟 → 移動不可
    return false;
  }

  const previousSibling = siblings[currentIndex - 1];

  if (previousSibling.type !== 'folder') {
    // 前の兄弟がファイル → 移動不可
    return false;
  }

  // previousSiblingの最後の子として移動
  return moveNode(node, previousSibling, 'last-child');
}

// Shift+Tab: 選択ノードを親の兄弟にする
function moveNodeUp(nodeId) {
  const node = state.nodes.get(nodeId);
  const parent = state.nodes.get(node.parent);

  if (!parent) {
    // ルートレベル → 移動不可
    return false;
  }

  const grandParent = state.nodes.get(parent.parent);
  const parentIndex = getSiblings(parent).indexOf(parent);

  // 親の直後に移動
  return moveNode(node, grandParent, parentIndex + 1);
}
```

**ファイルシステム操作:**

```javascript
async function moveNode(node, newParent, index) {
  const oldPath = node.path;
  const newPath = path.join(newParent.path, node.name);

  // パスの検証
  if (await fs.pathExists(newPath)) {
    throw new Error(`同名のファイル/フォルダが既に存在します: ${node.name}`);
  }

  // 移動実行（Node.js fs.rename）
  await fs.rename(oldPath, newPath);

  // ノード情報の更新
  node.path = newPath;
  node.parent = newParent.id;

  // 子ノードのパスも再帰的に更新
  if (node.type === 'folder' && node.children) {
    await updateChildPaths(node);
  }
}

async function updateChildPaths(parent) {
  for (const child of parent.children) {
    const oldPath = child.path;
    const newPath = path.join(parent.path, child.name);

    child.path = newPath;

    if (child.type === 'folder' && child.children) {
      await updateChildPaths(child);
    }
  }
}
```

### 7.2 トランザクション的な操作（将来実装）

**ロールバック可能な操作:**
```javascript
class FSTransaction {
  constructor() {
    this.operations = [];
  }

  async move(from, to) {
    await fs.rename(from, to);
    this.operations.push({ type: 'move', from, to });
  }

  async rollback() {
    for (const op of this.operations.reverse()) {
      if (op.type === 'move') {
        await fs.rename(op.to, op.from);
      }
    }
  }
}
```

---

## 8. エラーハンドリング

### 8.1 エラーの分類

| カテゴリ | 例 | 対応方法 |
|----------|-----|----------|
| **権限エラー** | 読み取り専用ファイルの変更 | エラー表示、操作をキャンセル |
| **パスエラー** | 存在しないパスへのアクセス | ツリーを再構築 |
| **衝突エラー** | 同名ファイルの作成 | ユーザーに名前変更を促す |
| **システムエラー** | ディスク容量不足 | エラーダイアログ表示 |
| **ネットワークエラー** | ネットワークドライブの切断 | リトライ or キャンセル |

### 8.2 エラーハンドリングの実装

**グローバルエラーハンドラー:**

```javascript
class ErrorHandler {
  static handle(error, context = {}) {
    console.error('Error:', error, 'Context:', context);

    // エラータイプに応じた処理
    if (error.code === 'EACCES') {
      return this.handlePermissionError(error, context);
    } else if (error.code === 'ENOENT') {
      return this.handleNotFoundError(error, context);
    } else if (error.code === 'EEXIST') {
      return this.handleAlreadyExistsError(error, context);
    } else {
      return this.handleGenericError(error, context);
    }
  }

  static handlePermissionError(error, context) {
    showNotification({
      type: 'error',
      title: '権限エラー',
      message: `ファイル操作の権限がありません: ${context.path}`,
    });
  }

  static handleNotFoundError(error, context) {
    // ツリーを再読み込み
    stateManager.loadTree(stateManager.state.rootPath);

    showNotification({
      type: 'warning',
      title: 'ファイルが見つかりません',
      message: 'ツリーを最新の状態に更新しました',
    });
  }

  static handleAlreadyExistsError(error, context) {
    showNotification({
      type: 'error',
      title: '名前の衝突',
      message: `同名のファイル/フォルダが既に存在します`,
    });
  }
}
```

### 8.3 ユーザーへのフィードバック

**通知システム:**
```javascript
class NotificationManager {
  show(notification) {
    const { type, title, message, duration = 3000 } = notification;

    const element = document.createElement('div');
    element.className = `notification notification-${type}`;
    element.innerHTML = `
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    `;

    document.body.appendChild(element);

    setTimeout(() => {
      element.classList.add('notification-fade-out');
      setTimeout(() => element.remove(), 300);
    }, duration);
  }
}
```

---

## 9. パフォーマンス最適化

### 9.1 レンダリング最適化

**仮想スクロール（将来実装）:**
- 表示領域外のノードはレンダリングしない
- 1000+ノードでもスムーズなスクロール

**差分レンダリング:**
```javascript
class OutlineTreeComponent {
  render() {
    const newTree = this.buildVirtualDOM();
    const patches = diff(this.currentTree, newTree);

    // 変更があった部分だけ更新
    applyPatches(this.container, patches);

    this.currentTree = newTree;
  }
}
```

### 9.2 ファイルシステム読み込み最適化

**段階的読み込み:**
```javascript
async function loadTreeIncremental(path, maxDepth = 2) {
  // 最初は2階層まで読み込み
  const tree = await readTreeUpToDepth(path, maxDepth);

  // フォルダ展開時に子を遅延読み込み
  tree.forEach(node => {
    if (node.type === 'folder') {
      node.loadChildren = async () => {
        node.children = await readTreeUpToDepth(node.path, 1);
      };
    }
  });

  return tree;
}
```

### 9.3 メモリ管理

**大きなツリーの対策:**
- WeakMapを使用してノード参照を管理
- 不要なノードはガベージコレクション対象にする
- 展開されていないフォルダの子ノードは保持しない

---

## 10. セキュリティ考慮事項

### 10.1 パストラバーサル対策

```javascript
function validatePath(targetPath, rootPath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error('パストラバーサル攻撃を検出しました');
  }

  return resolvedTarget;
}
```

### 10.2 Context Isolation

**Electron設定:**
```javascript
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,      // Node.js APIを無効化
    contextIsolation: true,      // コンテキスト分離を有効化
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

**preload.js:**
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readTree: (path) => ipcRenderer.invoke('fs:readTree', path),
  moveNode: (from, to) => ipcRenderer.invoke('fs:moveNode', from, to),
  onFsChanged: (callback) => ipcRenderer.on('fs:changed', callback),
});
```

### 10.3 入力検証

**ノード名のバリデーション:**
```javascript
function validateNodeName(name) {
  // 禁止文字
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;

  if (invalidChars.test(name)) {
    throw new Error('ファイル名に使用できない文字が含まれています');
  }

  // 最大長（macOS: 255バイト）
  if (Buffer.byteLength(name, 'utf8') > 255) {
    throw new Error('ファイル名が長すぎます（255バイト以下）');
  }

  // 予約名（Windows互換）
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(name)) {
    throw new Error('予約されたファイル名は使用できません');
  }

  return name;
}
```

---

## 付録A: 技術スタックの詳細

### 開発依存関係（package.json）

```json
{
  "name": "fliesend",
  "version": "0.1.0",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --debug",
    "build": "electron-builder"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "chokidar": "^4.0.0"
  }
}
```

### フォルダ構造

```
fliesend/
├── src/
│   ├── main/
│   │   ├── main.js              # Electronメインプロセス
│   │   ├── FileSystemManager.js
│   │   └── FileWatcher.js
│   ├── renderer/
│   │   ├── index.html
│   │   ├── index.js
│   │   ├── StateManager.js
│   │   └── components/
│   │       ├── OutlineTree.js
│   │       └── NotificationManager.js
│   ├── preload/
│   │   └── preload.js           # IPC bridge
│   └── styles/
│       └── main.css
├── package.json
└── README.md
```

---

## 付録B: 開発ガイドライン

### コーディング規約

**JavaScript/TypeScript:**
- ESLint + Prettier使用
- 関数は1つの責務のみ
- async/awaitを優先（Promiseチェーンは避ける）
- エラーハンドリングは必須

**命名規則:**
- クラス: PascalCase（例: `FileSystemManager`）
- 関数/変数: camelCase（例: `moveNode`）
- 定数: UPPER_SNAKE_CASE（例: `MAX_DEPTH`）
- プライベートメソッド: `_` プレフィックス（例: `_validatePath`）

### テスト方針（将来）

- ユニットテスト: Jest
- E2Eテスト: Spectron（Electron用）
- カバレッジ: 70%以上

---

**Status:** Draft
**Next Review:** プロトタイプ実装後に設計を見直し
