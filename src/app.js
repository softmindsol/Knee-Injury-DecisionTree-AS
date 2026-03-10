import express from 'express';
import diagnosisRoutes from './routes/diagnosis.routes.js';

const app = express();

app.use(express.json());

// API Routes
app.use('/api', diagnosisRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

export default app;
