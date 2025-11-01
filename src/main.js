/**
 * fließend - Main Process
 * Electronメインプロセスのエントリーポイント
 */

const { setupAppLifecycle, setupDevMode } = require('./window-manager');

// 開発モードの設定
setupDevMode();

// アプリケーションのライフサイクルを設定
setupAppLifecycle();
