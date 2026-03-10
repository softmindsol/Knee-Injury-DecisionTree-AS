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

            // If we reached here via a wildcard, it means it's a general suggestion
            if (result.matchedWildcard) {
                return {
                    status: 'suggestion',
                    message: "We don't have a specific clinical match for your description in our current algorithm, but here are some basic exercises you can perform for general knee health!",
                    recommended_exercises
                };
            }

            return { status: 'success', recommended_exercises };
        }

        if (result.status === 'missing_info') {
            const missing = new Set(result.missingAttributes);
            const allPossible = this.getAvailableAttributes();

            for (const attr in allPossible) {
                if (fields[attr] === undefined || fields[attr] === null) {
                    missing.add(attr);
                }
            }
            result.missingAttributes = Array.from(missing);
        }

        if (result.status === 'no_match') {
            const general_ids = ["ex_001", "ex_008", "ex_019"];
            const suggestions = general_ids.map(id => this.catalog[id]);

            return {
                status: 'suggestion',
                message: "We don't have a specific clinical match for your description in our current algorithm, but here are some basic exercises you can perform for general knee health!",
                recommended_exercises: suggestions
            };
        }

        return result;
    }

    /**
     * Dynamically crawls the decision tree and extracts every configurable attribute
     * mapping to its allowed choice values.
     * @returns {Object} Example: { "activity_trigger": ["running", "jumping"], ... }
     */
    getAvailableAttributes() {
        const attributes = {};

        const crawl = (node) => {
            if (!node) return;

            // If the node has an attribute, record the valid branches (excluding wildcard mapping "*")
            if (node.attribute && node.branches) {
                if (!attributes[node.attribute]) {
                    attributes[node.attribute] = new Set();
                }

                for (const key in node.branches) {
                    if (key !== "*") {
                        attributes[node.attribute].add(key);
                    }
                    crawl(node.branches[key]);
                }
            }
        };

        crawl(this.tree);

        // Convert Sets back to arrays and ALWAYS include 'other' as a fallback value for the AI
        const result = {};
        for (const [key, valSet] of Object.entries(attributes)) {
            const arr = Array.from(valSet);
            arr.push('other');
            result[key] = arr;
        }

        logger.info("DiagnosisService", "Extracted available attributes from tree", { attributes: result });
        return result;
    }
}

export default new DiagnosisService();
