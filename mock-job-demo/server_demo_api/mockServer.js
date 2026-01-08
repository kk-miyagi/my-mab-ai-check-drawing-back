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

// In-memory status store keyed by operation_id (dev only)
const operationState = new Map();

// 1) Operation ID issuance
// Support both /issue/operation-id/ (frontend) and /issue/operation_id/ (alt)
['/issue/operation-id/', '/issue/operation_id/'].forEach((path) => {
  app.post(path, (req, res) => {
    const operationId = `op_${Date.now()}`;
    operationState.set(operationId, { startedAt: Date.now(), status: 'start' });
    res.json({ operation_id: operationId, status: 'start' });
  });
});

// Epic init (JSON)
// initEpic.ts calls POST /epic-init/ with { user, epic, operation, operation_id, status: 'doing'|'end' }
['/epic-init/', '/epic_init/'].forEach((path) => {
  app.post(path, (req, res) => {
    const body = req.body ?? {};
    const operationId = body.operation_id ?? body.operationId;
    const status = body.status ?? 'doing';

    if (!operationId || String(operationId).trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'operation_id is required' });
    }

    const existing = operationState.get(operationId) ?? { startedAt: Date.now() };
    operationState.set(operationId, { ...existing, status });
    return res.json({ status, operation_id: operationId });
  });
});

// 2) Upload pairs (multipart) and 3) completion (JSON)
// Support both /upload/ (old) and /multi-fileupload/ (frontend) and /multi_fileupload/ (alt)
['/upload/', '/multi-fileupload/', '/multi_fileupload/'].forEach((path) => {
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

// 4) Check status (JSON)
// Support both /check-status/ (frontend) and /check_status/ (alt)
['/check-status/', '/check_status/'].forEach((path) => {
  app.post(path, (req, res) => {
    const body = req.body ?? {};
    const user = body.user;
    const epic = body.epic;
    const operation = body.operation;
    const operationId = body.operation_id ?? body.operationId;
    const requested = body.status;

    if (!user || String(user).trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'user is required' });
    }
    if (!epic || String(epic).trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'epic is required' });
    }
    if (!operation || String(operation).trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'operation is required' });
    }
    if (!operationId || String(operationId).trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'operation_id is required' });
    }

    if (!operationState.has(operationId)) {
      operationState.set(operationId, { startedAt: Date.now() });
    }
    const state = operationState.get(operationId);

    // If the client asks with status=end (verification phase), respond end.
    if (requested === 'end') {
      return res.json({
        user,
        epic,
        operation,
        operation_id: operationId,
        status: 'end',
        message: 'end',
      });
    }

    // Only report whether it's still running.
    return res.json({
      user,
      epic,
      operation,
      operation_id: operationId,
      status: 'doing',
      message: 'doing',
    });
  });
});

// Default to 8000 so it can stand in for the Python server without changing frontend config.
const port = Number(process.env.MOCK_PORT ?? 8000);
app.listen(port, () => {
  console.log(`[mock-server] listening on http://localhost:${port}`);
});
