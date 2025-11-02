/**
 * fließend - Rendering Module
 * 仮想DOMを使用したツリーのレンダリング機能
 */

import { h, diff, render } from './vdom.js';
import { getState } from './store.js';
import { selectNode, toggleNodeExpansion } from './navigation.js';
import { handleRenameNode, openFileInExternalEditor } from './event-handlers.js';

// DOM要素の参照
const outlineTree = document.getElementById('outlineTree');

// Virtual DOM tree
let vTree;

/**
 * HTML特殊文字をエスケープ
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * ツリー全体を描画
 */
export function renderTree() {
  const { tree, selectedNodeId, expandedNodes } = getState();
  const newVTree = tree ? renderNode(tree, 0, selectedNodeId, expandedNodes) : h('div', { class: 'empty-state' },
    h('p', {}, 'フォルダを選択して開始'),
    h('p', { class: 'empty-state-hint' }, '「フォルダを開く」ボタンをクリック')
  );

  const rootElement = outlineTree.childNodes[0];
  if (!vTree || !rootElement) {
    outlineTree.innerHTML = '';
    outlineTree.appendChild(render(newVTree));
  } else {
    const patch = diff(vTree, newVTree);
    patch(rootElement);
  }
  vTree = newVTree;
}

/**
 * ノードを再帰的に描画
 * @param {Object} node - 描画するノード
 * @param {number} level - インデントレベル
 * @param {string} selectedNodeId - 選択中のノードID
 * @param {Set} expandedNodes - 展開されているノードのSet
 */
export function renderNode(node, level, selectedNodeId, expandedNodes) {
  const isExpanded = expandedNodes.has(node.id);

  const children = (node.children && isExpanded)
    ? node.children.map(child => renderNode(child, level + 1, selectedNodeId, expandedNodes))
    : [];

  const props = {
    class: `tree-node ${selectedNodeId === node.id ? 'selected' : ''}`,
    'data-node-id': node.id,
    'data-node-type': node.type, // Keep type for backend logic, but UI is consistent
    'data-node-name': node.name,
    style: `padding-left: ${level * 20}px`,
    onclick: (e) => {
      e.stopPropagation();
      selectNode(node.id);
    },
  };

  const originalName = node.displayName === '' ? 'blank' : (node.displayName || escapeHtml(node.name));
  const nameElement = h('span', {
    class: 'tree-node-name',
    contenteditable: true, // Always editable
    onkeydown: (e) => {
      // Keydown logic will be handled in the main renderer.js
      if (e.key === 'Escape') {
        e.preventDefault();
        e.target.textContent = originalName;
        e.target.blur();
      }
    },
    onblur: (e) => {
      handleRenameNode(node.id, e.target.textContent);
    }
  }, originalName);

  return h('div', props,
    nameElement,
    ...children
  );
}

