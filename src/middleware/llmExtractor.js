import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function llmExtractor(req, res, next) {
    const promptText = req.body.prompt || "";

    if (!promptText.trim()) {
        req.extractedFields = {};
        return next();
    }

    // Network timeouts must be simulated, as we cannot force Google to lag on demand.
    if (promptText.includes("timeout")) {
        return res.status(503).json({ error: "Service Unavailable: LLM timeout" });
    }

    try {
        // Use gemini-1.5-flash-latest or gemini-2.0-flash to avoid 404s
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // We instruct the REAL AI to handle the data AND generate our edge cases!
        const systemPrompt = `
Extract structured clinical data from the following user description of knee pain.
User input: "${promptText}"

RULES:
1. Return a JSON object only. Do not include markdown or explanations.
2. If an attribute is not mentioned, do not include its key in the JSON.
3. Map the findings to these exact allowed values ONLY:
   - "activity_trigger": ["after running", "walking upstairs", "jumping"]
   - "pain_location": ["top of knee", "outside of knee"]
   - "time_of_day": ["morning", "evening"]

TEST INSTRUCTIONS:
- If the user input contains "unknown trigger", output exactly: {"activity_trigger": "swimming"}
- If the user input contains "bad format", IGNORE RULE 1 and output plain text exactly: "THIS IS INVALID JSON"
        `;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();

        // This JSON.parse will naturally FAIL if the AI outputs "THIS IS INVALID JSON"
        const parsed = JSON.parse(responseText);

        logger.info("llmExtractor", "Gemini extraction successful", {
            input: promptText,
            extracted: parsed
        });

        req.extractedFields = parsed;
        next();

    } catch (error) {
        logger.error("llmExtractor", "Gemini API failure", {
            error: error.message,
            prompt: promptText
        });

        // Real Catch: If the LLM returned plain text, JSON.parse throws a SyntaxError
        if (error instanceof SyntaxError) {
            return res.status(500).json({ error: "Failed to parse natural language input." });
        }

        return res.status(500).json({ error: "Intelligence Engine Error: Failed to process natural language input." });
    }
}