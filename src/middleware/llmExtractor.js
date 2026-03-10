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

    try {
        const timeoutMs = 15000;
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

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
        `;

        // Wait for the Gemini API call or throw an error after 15 seconds.
        const result = await Promise.race([
            model.generateContent(systemPrompt),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("LLM API timeout")), timeoutMs)
            )
        ]);

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
        if (error.message === "LLM API timeout") {
            logger.error("llmExtractor", "Gemini API timeout hit", { prompt: promptText });
            return res.status(503).json({ error: "Service Unavailable: The AI engine took too long to respond." });
        }

        logger.error("llmExtractor", "Gemini API failure", {
            error: error.message,
            prompt: promptText
        });

        // If the LLM returned plain text or unexpected, JSON.parse throws a SyntaxError
        if (error instanceof SyntaxError) {
            return res.status(500).json({ error: "Intelligence Engine Error: Failed to parse generated response." });
        }

        return res.status(500).json({ error: "Intelligence Engine Error: Failed to process natural language input." });
    }
}