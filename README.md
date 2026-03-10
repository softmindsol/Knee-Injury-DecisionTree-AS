# Knee Pain Triage & Recovery API

A production-grade Node.js (ESM) backend that utilizes Google Gemini AI to transform natural language patient descriptions into structured clinical data. This data drives a dynamic Decision Tree to provide deterministic, therapeutic exercise recommendations.

---

## 🚀 Project Instructions

### 1. Prerequisites
- **Node.js**: v20 or higher recommended.
- **Google Gemini API Key**: Obtain from [Google AI Studio](https://aistudio.google.com/).

### 2. Setup
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```

### 4. Running the Project
Start the production server:
```bash
npm start
```
*The server will run on `http://localhost:3000` by default.*

### 5. Running Tests
The project includes a comprehensive Jest test suite using ESM-native mocking:
```bash
npm test
```

---

## 🧠 Design Decisions

- **Deterministic Decision Logic**: While we use LLMs for extraction, the actual medical triage is handled by a hard-coded JSON Decision Tree. This ensures that the same clinical input always results in the same recommendation, preventing "AI hallucinations" in medical contexts.
- **Dynamic AI Context**: Instead of hardcoding prompts, the system crawls the `tree.json` at runtime to extract all possible attributes and values. This is injected into the Gemini `responseSchema`, turning the AI into a strict classifier rather than a creative writer.
- **Stateless Architecture**: The API identifies missing information but does not store session state. This allows for horizontal scaling and shifts the burden of multi-turn conversation state to the frontend client.

---

## 🛠 Technical Solutions

### 7. Extending the Decision Tree
**Scenario**: Adding a new factor like `time_of_day` (morning vs night) to influence recovery steps.

**Implementation**:
- **JSON Modification**: Insert `time_of_day` as a new `attribute` node in `tree.json`.
- **Backward Compatibility**: Always include a `*` (wildcard) branch under new attributes. If older clients or ambiguous prompts don't provide the time, the system safely falls through to a default exercise set.
- **Zero-Code LLM Update**: The `llmExtractor` middleware uses `DiagnosisService.getAvailableAttributes()`. As soon as the JSON is updated, the LLM will automatically receive instructions to extract "time_of_day" without any developer modifying the JavaScript code.

### 8. Missing Information Handling
**Scenario**: A user says *"my knee hurts when I walk upstairs"* but doesn't mention which knee or the type of pain.

**Implementation**:
- **Proactive Scanning**: When the `traverseTree` utility hits a node where a value is undefined, the `DiagnosisService` doesn't just return the first missing field. It scans the entire decision model to find *all* missing required fields.
- **Response Format**: The API returns a `200 OK` with a `missing_info` status. It provides an array of `follow_up_questions` (e.g., `["Please provide your pain_side", "Please provide your pain_description"]`), allowing the user to provide all missing context in one go.

### 9. Ambiguous Prompt Resolution
**Scenario**: A user says *"it hurts when I go up stairs"*, which needs to map to the tree's `"walking upstairs"` key.

**Implementation**:
- **Schema Mapping**: We move away from open-ended extraction and use **Classificaiton**.
- **Enum Enforcement**: We pass the exact keys from `tree.json` (e.g., `"walking upstairs"`, `"after running"`) into the Gemini `responseSchema` as an Enum list. 
- **Mapping Logic**: The system prompt instructs the AI to map synonyms (e.g., "climbing steps", "up the stairs") to the *closest* matching allowed Enum value defined in our clinical tree.

### 10. Schema Mismatch & Normalization
**Scenario**: LLM outputs `"jogging"` but the tree expects `"running"`.

**Implementation**:
- **Strict Constraint Injection**: By defining a custom `responseSchema` in the Google Generative AI SDK, the model is physically constrained to return only the values present in our tree. It essentially "sanitizes" the user's input before it hits the application logic.
- **Middleware Sanitization**: For high-robustness scenarios, we recommend a post-LLM normalization layer using `string-similarity` (Levenshtein distance). This validates the LLM's output against the tree's keys one last time to fix minor tense or casing mismatches (e.g., `"click"` vs `"clicking"`) before final traversal.

---

## 📂 Folder Structure
- `src/controllers/`: API request/response orchestration.
- `src/services/`: Core logic for tree initialization and data extraction.
- `src/middleware/`: Gemini AI integration and schema enforcement.
- `src/utils/`: Deterministic tree traversal and validation logic.
- `src/data/`: `tree.json` (Clinical paths) and `catalog.json` (Exercise data).
