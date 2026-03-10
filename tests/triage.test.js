import request from 'supertest';
import app from '../src/app.js';
import { validateTree } from '../src/utils/validator.js';

describe('Knee Pain Triage System', () => {
  describe('POST /api/diagnose', () => {
    it('should return correct exercises for valid input (Happy Path)', async () => {
      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "hurts when I walk upstairs" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recommended_exercises');
      expect(res.body.recommended_exercises[0].name).toBe('Step-ups');
    });

    it('should return a follow-up question when information is missing', async () => {
      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "left knee aches after running and top" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'More info needed');
      expect(res.body.follow_up_questions[0]).toContain('time_of_day');
    });

    it('should return a 404 error for unknown input / unmapped branch', async () => {
      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "unknown trigger" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('No matching diagnosis found');
    });

    it('should return 503 on API Timeout', async () => {
      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "timeout" });

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('timeout');
    });

    it('should return 500 on Bad JSON format from LLM', async () => {
      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "bad format" });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed to parse');
    });
  });

  describe('Tree Validation', () => {
    const catalog = {
      "ex_001": { "name": "Quad Stretch", "reps": 10 }
    };

    it('should throw an error on a dead end', () => {
      const deadEndTree = {
        id: "node_1",
        attribute: "test"
      };

      expect(() => validateTree(deadEndTree, catalog)).toThrow(/Dead end/);
    });

    it('should throw an error on a missing catalog ID', () => {
      const invalidTree = {
        id: "node_1",
        exercises: ["ex_999"]
      };

      expect(() => validateTree(invalidTree, catalog)).toThrow(/not found in catalog/);
    });

    it('should throw an error on circular reference', () => {
      const circularTree = {
        id: "node_1",
        attribute: "test",
        branches: {}
      };
      circularTree.branches["yes"] = circularTree;

      expect(() => validateTree(circularTree, catalog)).toThrow(/Circular reference/);
    });
  });
});
