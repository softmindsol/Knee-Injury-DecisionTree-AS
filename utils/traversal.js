function traverseTree(node, fields, logger) {
  if (node.exercises) {
    logger.info("traverseTree", "Leaf node reached", { exercises: node.exercises });
    return { status: 'success', exercises: node.exercises };
  }

  const attr = node.attribute;
  const providedValue = fields[attr];

  if (providedValue === undefined || providedValue === null) {
    logger.info("traverseTree", "Missing info for attribute", { attribute: attr });
    return { status: 'missing_info', missingAttribute: attr };
  }

  if (node.branches) {
    if (node.branches[providedValue]) {
      logger.info("traverseTree", "Branch selected", { attribute: attr, value: providedValue });
      return traverseTree(node.branches[providedValue], fields, logger);
    } else if (node.branches["*"]) {
      logger.info("traverseTree", "Wildcard branch selected", { attribute: attr, value: providedValue });
      return traverseTree(node.branches["*"], fields, logger);
    }
  }

  logger.info("traverseTree", "No match found", { attribute: attr, providedValue });
  return { status: 'no_match', attribute: attr, providedValue };
}

module.exports = { traverseTree };
