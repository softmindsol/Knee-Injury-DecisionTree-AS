import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { traverseTree } from '../utils/traversal.js';
import { validateTree } from '../utils/validator.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DiagnosisService {
    constructor() {
        this.tree = null;
        this.catalog = null;
        this.initialize();
    }

    initialize() {
        try {
            const treePath = path.join(__dirname, '../data/tree.json');
            const catalogPath = path.join(__dirname, '../data/catalog.json');

            this.tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
            this.catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

            validateTree(this.tree, this.catalog);
            logger.info("DiagnosisService", "Decision tree and catalog loaded and validated");
        } catch (error) {
            logger.error("DiagnosisService", "Failed to initialize diagnosis service", { error: error.message });
            throw error;
        }
    }

    diagnose(fields) {
        const result = traverseTree(this.tree, fields, logger);

        if (result.status === 'success') {
            const recommended_exercises = result.exercises.map(id => this.catalog[id]);
            return { status: 'success', recommended_exercises };
        }

        return result;
    }
}

export default new DiagnosisService();
