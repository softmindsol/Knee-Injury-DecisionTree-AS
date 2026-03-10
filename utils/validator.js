function validateTree(node, catalog, visitedIds = new Set()) {
  if (!node) return;

  if (node.id) {
    if (visitedIds.has(node.id)) {
      throw new Error(`Circular reference detected at node id: ${node.id}`);
    }
    visitedIds.add(node.id);
  }

  // Dead end check: no branches and no exercises
  if (!node.branches && (!node.exercises || node.exercises.length === 0)) {
    throw new Error(`Dead end detected at node id: ${node.id}`);
  }

  // Check exercises in catalog
  if (node.exercises) {
    for (const exId of node.exercises) {
      if (!catalog[exId]) {
        throw new Error(`Exercise ID ${exId} not found in catalog`);
      }
    }
  }

  // Recursively check branches
  if (node.branches) {
    for (const key in node.branches) {
      validateTree(node.branches[key], catalog, new Set(visitedIds));
    }
  }
}

module.exports = { validateTree };
