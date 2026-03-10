import 'dotenv/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import logger from '../utils/logger.js';
import diagnosisService from '../services/diagnosis.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function llmExtractor(req, res, next) {
    const promptText = req.body.prompt || "";

    if (!promptText.trim()) {
        req.extractedFields = {};
        return next();
    }

    try {
        const timeoutMs = 15000;

        // Fetch dynamic attributes from the Decision Tree
        const availableAttributes = diagnosisService.getAvailableAttributes();

        // Build schema and explicit prompt rules dynamically
        const schemaProperties = {};
        let rulesText = "";

        for (const [attr, options] of Object.entries(availableAttributes)) {
            const joinedOptions = options.map(o => `'${o}'`).join(', ');
            schemaProperties[attr] = {
                type: SchemaType.STRING,
                description: `Extract the '${attr}'. MUST be one of: [${joinedOptions}]. Omit if missing.`
            };
            rulesText += `- ${attr}: [${joinedOptions}]\n`;
        }

        const responseSchema = {
            type: SchemaType.OBJECT,
            properties: schemaProperties
        };

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1
            }
        });

        const systemPrompt = `
You are an expert clinical data extractor for a knee pain triage system. Process the user's description and extract ALL relevant clinical attributes based on the allowed values below.

USER INPUT: "${promptText}"

STRICT EXTRACTION RULES:
1. Examine the user's input for every attribute listed under "ALLOWED VALUES".
2. If the user mentions a trait that matches an allowed value (e.g., "aching sharply" matches pain_description: sharp), extract it.
3. RETURN ONLY A JSON OBJECT.
4. If an attribute name is not explicitly mentioned but its description is (e.g., "hurts when I run" maps to activity_trigger: after running), map it to the correct allowed value.
5. IMPORTANT: If the user provides a value that is NOT in the allowed list but CLEARLY describes that attribute (e.g., "crawling" is an activity), map that attribute to 'other'.

ALLOWED VALUES FOR EXTRACTION:
${rulesText}
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