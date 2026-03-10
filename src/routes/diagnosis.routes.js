import { Router } from 'express';
import { handleDiagnosis } from '../controllers/diagnosis.controller.js';
import llmExtractor from '../middleware/llmExtractor.js';

const router = Router();

router.post('/diagnose', llmExtractor, handleDiagnosis);

export default router;
