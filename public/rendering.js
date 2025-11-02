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
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

  // Static icon (bullet or square)
  const icon = h('span', {}, node.type === 'folder' ? '▪' : '・');

  // Arrow icon (only for folders with children, shown on hover)
  let arrowIcon = null;
  if (node.type === 'folder' && hasChildren) {
    arrowIcon = h('span', { class: 'folder-arrow' }, isExpanded ? '▼' : '▶');
  }

  const children = (node.type === 'folder' && isExpanded && node.children)
    ? node.children.map(child => renderNode(child, level + 1, selectedNodeId, expandedNodes))
    : [];

  const props = {
    class: `tree-node ${selectedNodeId === node.id ? 'selected' : ''}`,
    'data-node-id': node.id,
    'data-node-type': node.type,
    'data-node-name': node.name,
    style: `padding-left: ${level * 20}px`,
  };

  if (node.type === 'folder') {
    props.onclick = (e) => {
      e.stopPropagation();
      selectNode(node.id);
      toggleNodeExpansion(node.id);
    };
  } else {
    props.onclick = (e) => {
      e.stopPropagation();
      selectNode(node.id);
      openFileInExternalEditor(node.path);
    };
  }

  const nameElement = h('span', {
    class: 'tree-node-name',
    contenteditable: selectedNodeId === node.id,
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    },
    onblur: (e) => {
      handleRenameNode(node.id, e.target.textContent);
    }
  }, node.displayName === '' ? 'blank' : (node.displayName || escapeHtml(node.name)));

  return h('div', props,
    h('span', { class: 'tree-node-icon' }, arrowIcon, icon),
    nameElement,
    ...children
  );
}

