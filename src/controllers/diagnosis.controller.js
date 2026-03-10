import diagnosisService from '../services/diagnosis.service.js';

export const handleDiagnosis = (req, res) => {
    const fields = req.extractedFields;
    const result = diagnosisService.diagnose(fields);

    if (result.status === 'success') {
        return res.json({ recommended_exercises: result.recommended_exercises });
    } else if (result.status === 'missing_info') {
        return res.status(200).json({
            message: "More info needed",
            follow_up_questions: [`Please provide your ${result.missingAttribute}`]
        });
    } else if (result.status === 'no_match') {
        return res.status(404).json({ error: "No matching diagnosis found" });
    }

    return res.status(500).json({ error: "Unexpected error during diagnosis" });
};
