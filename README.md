# Knee Pain Triage System

A production-ready Express.js API that uses a (mocked) LLM to extract structured data from natural language descriptions of knee pain, navigates a JSON decision tree, and returns recommended physical therapy exercises.

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the server:
   ```bash
   npm start
   ```

3. Run the tests:
   ```bash
   npm test
   ```

## Features

### Extensibility (Wildcard Branches)
The decision tree supports a `*` wildcard branch. If a user provides an attribute value that doesn't match any specific branch, the system will follow the `*` branch if it exists. For example, in `time_of_day`, if the user specifies "evening" but only "morning" and `*` are defined, it will fall back to the `*` branch and return the default exercises (`ex_001` and `ex_004`).

### Missing Information Handling
If the LLM fails to extract a required attribute for the current node in the decision tree, the traversal halts. The API returns a `200 OK` response with a `missing_info` status and prompts the user with a follow-up question (e.g., "Please provide your time_of_day").

### Resolving Ambiguous Prompts & Schema Mismatches
In a real-world scenario, ambiguous prompts and schema mismatches can be mitigated by:
- **LLM Enums:** Constraining the LLM to only output specific enum values for attributes (e.g., `pain_location` must be "top of knee", "outside of knee", etc.).
- **System Prompts:** Providing clear instructions to the LLM on how to classify ambiguous inputs.
- **Structured JSON Outputs:** Using features like OpenAI's JSON mode or function calling to ensure the output strictly adheres to the expected schema.
