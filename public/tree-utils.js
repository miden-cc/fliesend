/**
 * Tree Traversal Utilities
 */

/**
 * Finds a node in the tree by its ID.
 * @param {object} node The starting node.
 * @param {string} targetId The ID of the node to find.
 * @returns {object|null} The found node or null.
 */
export function findNodeById(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Finds the parent of a node in the tree.
 * @param {object} node The starting node.
 * @param {string} targetId The ID of the node whose parent to find.
 * @returns {object|null} The parent node or null.
 */
export function findParentNode(node, targetId) {
  if (!node || !node.children) return null;
  for (const child of node.children) {
    if (child.id === targetId) return node;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Gets a flat list of all visible nodes in the tree.
 * @param {object} tree The root of the tree.
 * @param {Set<string>} expandedNodes A set of expanded node IDs.
 * @returns {Array<object>} A flat list of visible nodes.
 */
export function getVisibleNodes(tree, expandedNodes) {
  const visible = [];
  function traverse(node) {
    if (!node) return;
    visible.push(node);
    if (node.type === 'folder' && expandedNodes.has(node.id) && node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  traverse(tree);
  return visible;
}
