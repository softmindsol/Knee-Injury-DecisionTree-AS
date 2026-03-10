const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { validateTree } = require('./utils/validator');
const llmExtractor = require('./middleware/llmExtractor');
const { traverseTree } = require('./utils/traversal');

const app = express();
app.use(express.json());

const treePath = path.join(__dirname, 'data', 'tree.json');
const catalogPath = path.join(__dirname, 'data', 'catalog.json');

let tree, catalog;

try {
  tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  validateTree(tree, catalog);
  logger.info("server", "Tree validated successfully");
} catch (error) {
  logger.error("server", "Tree validation failed on startup", { error: error.message });
  process.exit(1);
}

app.post('/diagnose', llmExtractor, (req, res) => {
  const fields = req.extractedFields;
  const result = traverseTree(tree, fields, logger);

  if (result.status === 'success') {
    const recommended_exercises = result.exercises.map(id => catalog[id]);
    return res.json({ recommended_exercises });
  } else if (result.status === 'missing_info') {
    return res.status(200).json({
      message: "More info needed",
      follow_up_questions: [`Please provide your ${result.missingAttribute}`]
    });
  } else if (result.status === 'no_match') {
    return res.status(404).json({ error: "No matching diagnosis found" });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info("server", `Server running on port ${PORT}`);
  });
}

module.exports = app;
