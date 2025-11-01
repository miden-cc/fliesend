/**
 * Simple Virtual DOM Implementation
 */

/**
 * Creates a virtual DOM node.
 * @param {string} type The element type.
 * @param {object} props The element properties.
 * @param {Array<object|string>} children The child nodes.
 * @returns {object} A virtual DOM node.
 */
export function h(type, props, ...children) {
  return { type, props: props || {}, children: children.flat() };
}

/**
 * Diffs two virtual DOM trees and returns a set of patches.
 * @param {object} oldVTree The old virtual DOM tree.
 * @param {object} newVTree The new virtual DOM tree.
 * @returns {Function} A function that applies the patches.
 */
export function diff(oldVTree, newVTree) {
  if (newVTree === undefined) {
    return (node) => {
      node.remove();
      return undefined;
    };
  }

  if (typeof oldVTree === 'string' || typeof newVTree === 'string') {
    if (oldVTree !== newVTree) {
      return (node) => {
        const newNode = render(newVTree);
        node.replaceWith(newNode);
        return newNode;
      };
    } else {
      return (node) => node;
    }
  }

  if (oldVTree.type !== newVTree.type) {
    return (node) => {
      const newNode = render(newVTree);
      node.replaceWith(newNode);
      return newNode;
    };
  }

  const patchAttrs = diffAttrs(oldVTree.props, newVTree.props);
  const patchChildren = diffChildren(oldVTree.children, newVTree.children);

  return (node) => {
    patchAttrs(node);
    patchChildren(node);
    return node;
  };
}

/**
 * Diffs the attributes of two virtual DOM nodes.
 * @param {object} oldAttrs The old attributes.
 * @param {object} newAttrs The new attributes.
 * @returns {Function} A function that applies the attribute patches.
 */
function diffAttrs(oldAttrs, newAttrs) {
  const patches = [];

  // Set new attributes
  for (const [key, value] of Object.entries(newAttrs)) {
    patches.push((node) => {
      node.setAttribute(key, value);
      return node;
    });
  }

  // Remove old attributes
  for (const key in oldAttrs) {
    if (!(key in newAttrs)) {
      patches.push((node) => {
        node.removeAttribute(key);
        return node;
      });
    }
  }

  return (node) => {
    for (const patch of patches) {
      patch(node);
    }
  };
}

/**
 * Diffs the children of two virtual DOM nodes.
 * @param {Array<object|string>} oldChildren The old children.
 * @param {Array<object|string>} newChildren The new children.
 * @returns {Function} A function that applies the child patches.
 */
function diffChildren(oldChildren, newChildren) {
  const childPatches = [];
  oldChildren.forEach((oldChild, i) => {
    childPatches.push(diff(oldChild, newChildren[i]));
  });

  const additionalPatches = [];
  if (newChildren.length > oldChildren.length) {
    for (const additionalChild of newChildren.slice(oldChildren.length)) {
      additionalPatches.push((node) => {
        node.appendChild(render(additionalChild));
        return node;
      });
    }
  }

  return (parent) => {
    parent.childNodes.forEach((child, i) => {
      childPatches[i](child);
    });

    for (const patch of additionalPatches) {
      patch(parent);
    }
  };
}

/**
 * Renders a virtual DOM node into a real DOM node.
 * @param {object|string} vNode The virtual DOM node.
 * @returns {Node} The real DOM node.
 */
export function render(vNode) {
  if (vNode === null || vNode === undefined) {
    return document.createTextNode('');
  }
  if (typeof vNode === 'string') {
    return document.createTextNode(vNode);
  }

  const { type, props, children } = vNode;
  const el = document.createElement(type);

  for (const [key, value] of Object.entries(props)) {
    el.setAttribute(key, value);
  }

  for (const child of children) {
    el.appendChild(render(child));
  }

  return el;
}
