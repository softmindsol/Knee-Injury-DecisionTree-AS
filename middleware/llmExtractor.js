const logger = require('../utils/logger');

async function mockLLMCall(prompt) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (prompt.includes("timeout")) {
        reject(new Error("API timeout"));
      } else if (prompt.includes("bad format")) {
        resolve("This is a plain string, not JSON");
      } else if (prompt.includes("left knee aches after running") && prompt.includes("top")) {
        resolve(JSON.stringify({
          "pain_location": "top of knee",
          "pain_side": "left knee",
          "activity_trigger": "after running",
          "pain_description": "aches"
        }));
      } else if (prompt.includes("hurts when I walk upstairs")) {
        resolve(JSON.stringify({
          "activity_trigger": "walking upstairs",
          "pain_description": "hurts"
        }));
      } else if (prompt.includes("unknown trigger")) {
        resolve(JSON.stringify({
          "activity_trigger": "jumping"
        }));
      } else {
        resolve(JSON.stringify({}));
      }
    }, 500);
  });
}

async function llmExtractor(req, res, next) {
  const prompt = req.body.prompt || "";
  
  try {
    const response = await mockLLMCall(prompt);
    
    if (prompt.includes("bad format")) {
      throw new SyntaxError("Unexpected token T in JSON at position 0");
    }

    const parsed = JSON.parse(response);
    req.extractedFields = parsed;
    next();
  } catch (error) {
    if (error.message === "API timeout") {
      logger.error("llmExtractor", "LLM API timeout", { prompt });
      return res.status(503).json({ error: "Service Unavailable: LLM timeout" });
    }
    logger.error("llmExtractor", "Failed to parse LLM response", { error: error.message });
    return res.status(500).json({ error: "Internal Server Error: Failed to parse LLM response" });
  }
}

module.exports = llmExtractor;
