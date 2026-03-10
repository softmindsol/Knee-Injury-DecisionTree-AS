import { jest } from '@jest/globals';

// A shared mock that is accessible inside the test context
const mockGenerateContent = jest.fn();

// In ESM, unstable_mockModule is the standard way to mock dependencies
jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() { }
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
  SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING' }
}));

// We must use dynamic imports after the mock is defined to ensure it is used
const { default: app } = await import('../src/app.js');
const { default: request } = await import('supertest');
const { validateTree } = await import('../src/utils/validator.js');

describe('Knee Pain Triage System - Real User Scenarios', () => {

  beforeEach(() => {
    // Reset all mock implementations and call history before each test
    mockGenerateContent.mockReset();
    jest.clearAllMocks();
  });

  describe('POST /api/diagnose', () => {
    it('should return correct exercises for a specific match (Run + Top + Left + Sharp)', async () => {
      // Setup the implementation specifically for this test
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            activity_trigger: "after running",
            pain_location: "top of knee",
            pain_side: "left",
            pain_description: "sharp"
          })
        }
      });

      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "Ever since I started running last week, I get this sharp pain right on the top of my left knee." });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recommended_exercises');
      expect(res.body.recommended_exercises).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Quad Stretch' }),
          expect.objectContaining({ name: 'Short Arc Quads' })
        ])
      );
    });

    it('should handle missing info by providing multiple follow-up questions', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            activity_trigger: "walking upstairs"
          })
        }
      });

      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "My knee hurts when I walk upstairs." });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'More info needed');
      expect(res.body.follow_up_questions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('pain_description'),
          expect.stringContaining('pain_side'),
          expect.stringContaining('pain_location')
        ])
      );
    });

    it('should return a suggestion when the activity is unrecognized (other)', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            activity_trigger: "other"
          })
        }
      });

      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "My knees hurt when I'm crawling on the floor." });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('We don\'t have a specific clinical match for your description in our current algorithm, but here are some basic exercises you can perform for general knee health!');
      expect(res.body).toHaveProperty('recommended_exercises');
      expect(res.body.recommended_exercises[0].name).toBe('Quad Stretch');
    });

    it('should handle LLM API timeouts with 503', async () => {
      // For timeout, we want generateContent to never resolve or to throw an specific error
      mockGenerateContent.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("LLM API timeout")), 1);
        });
      });

      const res = await request(app)
        .post('/api/diagnose')
        .send({ prompt: "Timeout test prompt" });

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('took too long');
    });
  });

  describe('Data Integrity Validation', () => {
    const catalog = {
      "ex_001": { "name": "Quad Stretch", "reps": 10 }
    };

    it('should catch dead-end nodes during tree validation', () => {
      const deadEndTree = { id: "bad_node", attribute: "missing_branches" };
      expect(() => validateTree(deadEndTree, catalog)).toThrow();
    });

    it('should catch invalid exercise references', () => {
      const invalidTree = { id: "bad_node", exercises: ["NON_EXISTENT_ID"] };
      expect(() => validateTree(invalidTree, catalog)).toThrow();
    });
  });
});
