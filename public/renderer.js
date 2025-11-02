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
  handleCreateNode,
  handleCreateSiblingFolder,
  handleDeleteNode
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
  document.getElementById('newFileBtn').addEventListener('click', () => handleCreateNode('file'));
  document.getElementById('newFolderBtn').addEventListener('click', () => handleCreateNode('folder'));
  document.getElementById('deleteBtn').addEventListener('click', handleDeleteNode);

  // キーボードイベント
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * キーボードイベントのハンドリング
 */
function handleKeyDown(event) {
  const { tree, selectedNodeId, expandedNodes } = getState();
  if (!tree) return;

  // contenteditable要素内での編集中は、Escapeキー以外は無視
  if (event.target.isContentEditable) {
    if (event.key === 'Escape') event.target.blur();
    return;
  }

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
      if (document.activeElement.isContentEditable) return;
      event.preventDefault();
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node.type === 'folder') {
          toggleNodeExpansion(selectedNodeId);
        } else {
          // Assuming you have a function to open files.
          // Replace with your actual implementation.
          window.electronAPI.openFile(node.path);
        }
      }
      break;
    case ' ':
      event.preventDefault();
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node && node.type === 'folder') {
          toggleNodeExpansion(selectedNodeId);
        }
      }
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node && node.type === 'folder' && !expandedNodes.has(selectedNodeId)) {
          toggleNodeExpansion(selectedNodeId);
        }
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (selectedNodeId) {
        const node = findNodeById(tree, selectedNodeId);
        if (node && node.type === 'folder' && expandedNodes.has(selectedNodeId)) {
          toggleNodeExpansion(selectedNodeId);
        }
      }
      break;
    case 'Tab':
      event.preventDefault();
      if (selectedNodeId) {
        if (event.shiftKey) {
          outdentNode();
        } else {
          indentNode();
        }
      }
      break;
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      handleDeleteNode();
      break;
    case 'F2':
      event.preventDefault();
      if (selectedNodeId) {
        const outlineTree = document.getElementById('outlineTree');
        const nodeElement = outlineTree.querySelector(`[data-node-id="${selectedNodeId}"] .tree-node-name`);
        if (nodeElement) {
          nodeElement.focus();
          document.execCommand('selectAll', false, null);
        }
      }
      break;
  }
}

/**
 * アプリケーションの起動
 */
document.addEventListener('DOMContentLoaded', init);
