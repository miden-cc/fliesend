/**
 * Simple State Management Store
 */

let state = {
  rootPath: null,
  tree: null,
  expandedNodes: new Set(),
  selectedNodeId: null
};

const listeners = [];

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribe(listener) {
  listeners.push(listener);
  return function unsubscribe() {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

export function getState() {
  return state;
}

export function setState(newState) {
  state = { ...state, ...newState };
  notify();
}
