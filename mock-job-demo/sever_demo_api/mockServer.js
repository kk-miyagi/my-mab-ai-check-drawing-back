import express from 'express';
import multer from 'multer';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Basic CORS (dev only)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// 1) Operation ID issuance
app.post('/issue/operation_id/', (req, res) => {
  const operationId = `op_${Date.now()}`;
  res.json({ operation_id: operationId, status: 'start' });
});

// 2) Upload pairs (multipart) and 3) completion (JSON)
// Support both /upload/ (old) and /multi_fileupload/ (current frontend endpoint)
['/upload/', '/multi_fileupload/'].forEach((path) => {
  app.post(path, upload.any(), (req, res) => {
    // JSON payload (completion)
    if (req.is('application/json')) {
      const { operation_id, sum_number } = req.body ?? {};
      return res.json({
        status: 'end',
        operation_id: operation_id ?? 'op_mock',
        sum_number: Number(sum_number ?? 0),
      });
    }

    // Multipart payload (doing)
    const { operation_id, number } = req.body ?? {};
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      return res.json({
        status: 'error',
        operation_id: operation_id ?? 'op_mock',
        number: -1,
        file_name: 'all',
        message: 'No files received. Please re-upload all files.',
      });
    }

    const received = files.map((f) => ({ field: f.fieldname, name: f.originalname }));
    const receivedNames = received.map((r) => `${r.field}:${r.name}`);

    // Echo back received file names and fields so the frontend can verify bf_file/bf_file_csv 等
    res.json({
      status: 'doing',
      operation_id: operation_id ?? 'op_mock',
      number: Number(number ?? 1),
      file_name: receivedNames.join(', '),
    });
  });
});

// Default to 8000 so it can stand in for the Python server without changing frontend config.
const port = Number(process.env.MOCK_PORT ?? 8000);
app.listen(port, () => {
  console.log(`[mock-server] listening on http://localhost:${port}`);
});
