/**
 * fließend - Renderer Process
 * レンダラープロセスのメインスクリプト
 */

import { subscribe } from './store.js';
import { getState } from './store.js';
import { findNodeById } from './tree-utils.js';
import { updateStatus } from './feedback.js';
import { renderTree } from './rendering.js';
import {
  navigateUp,
  navigateDown,
  outdentNode,
  indentNode,
  toggleNodeExpansion
} from './navigation.js';
import {
  handleOpenFolder,
  handleDeleteNode,
  handleEnterKey,
  handleBackspaceKey
} from './event-handlers.js';

/**
 * 初期化
 */
function init() {
  console.log('fließend initialized');
  updateStatus('準備完了');

  // イベントリスナーの設定
  setupEventListeners();
  subscribe(renderTree); // Subscribe to state changes
  renderTree(); // Initial render
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // ボタンイベント
  document.getElementById('openFolderBtn').addEventListener('click', handleOpenFolder);
  // 'newFileBtn', 'newFolderBtn', 'deleteBtn' are removed as they are not part of the outliner concept

  // キーボードイベント
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * キーボードイベントのハンドリング
 */
function handleKeyDown(event) {
  const { selectedNodeId } = getState();
  if (!selectedNodeId) return;

  // We are always in a contenteditable element in the outliner model
  if (!event.target.classList.contains('tree-node-name')) return;


  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      navigateUp();
      break;
    case 'ArrowDown':
      event.preventDefault();
      navigateDown();
      break;
    case 'Enter':
      event.preventDefault();
      handleEnterKey(event, selectedNodeId);
      break;
    case 'Backspace':
      handleBackspaceKey(event, selectedNodeId);
      break;
    case 'Tab':
      event.preventDefault();
      if (event.shiftKey) {
        outdentNode();
      } else {
        indentNode();
      }
      break;
    // We keep the default delete behavior for selected text, etc.
    // The outliner delete logic is handled by handleBackspaceKey at the start of a line.
  }
}

/**
 * アプリケーションの起動
 */
document.addEventListener('DOMContentLoaded', init);
