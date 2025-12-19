const PROCESS_DURATION_MS = 10000;

export const mockApi = {
  startJob: async (): Promise<{ job_id: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const jobId = `job-${Math.floor(Math.random() * 10000)}`;
        const startTime = Date.now();
        sessionStorage.setItem(`job_${jobId}_start`, String(startTime));
        console.log(`[MockServer] Job ${jobId} started at ${new Date(startTime).toLocaleTimeString()}`);
        resolve({ job_id: jobId });
      }, 500);
    });
  },

  checkStatus: async (
    jobId: string
  ): Promise<{
    job_id: string;
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    result: { message: string; data_url: string } | null;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const startTime = sessionStorage.getItem(`job_${jobId}_start`);

        if (!startTime) {
          resolve({ status: 'failed', progress: 0, error: 'Job not found', job_id: jobId, result: null });
          return;
        }

        const elapsed = Date.now() - parseInt(startTime, 10);
        const percent = Math.min(100, Math.floor((elapsed / PROCESS_DURATION_MS) * 100));

        let status: 'processing' | 'completed' | 'failed' = 'processing';
        let result: { message: string; data_url: string } | null = null;

        if (percent >= 100) {
          status = 'completed';
          result = { message: '分析が正常に完了しました！', data_url: '/download/report.pdf' };
        }

        console.log(`[MockServer] Job ${jobId} status: ${status} (${percent}%)`);

        resolve({
          job_id: jobId,
          status,
          progress: percent,
          result,
        });
      }, 300);
    });
  },
};

// --- フロント側が想定するサーバーレスポンス仕様（アップロード系） ---
// 1) ID発行リクエスト (/issue/operation_id/)
//    送信: { user, epic, operation, operation_id: null, status: 'start' }
//    受信: { operation_id: string, status: 'start', message?: string }
//
// 2) 複数ファイルアップロード (/upload/ : FormData)
//    送信: { user, epic, operation, operation_id, status: 'doing', number, files[] }
//    受信例:
//      - 正常継続: { status: 'doing', operation_id, number }
//      - 再送指示: { status: 'end', operation_id, number, file_name? } // number=-1 なら全再送
//
// 3) 完了通知 (/upload/ : JSON)
//    送信: { user, epic, operation, operation_id, status: 'end', sum_number }
//    受信例:
//      - 正常終了: { status: 'end', operation_id, sum_number }
//      - エラー   : { status: 'error', operation_id, number?, file_name?, message? }

export type UploadServerIssueResponse = {
  operation_id: string;
  status: 'start';
  message?: string;
};

export type UploadServerDoingResponse = {
  status: 'doing' | 'end';
  operation_id: string;
  number?: number; // 再送指示時や進捗返却時の番号 (1-based, -1=全再送)
  file_name?: string; // 再送してほしいファイル名
  message?: string;
};

export type UploadServerEndResponse = {
  status: 'end' | 'error';
  operation_id: string;
  sum_number?: number; // 送信完了リクエスト総数
  number?: number; // 再送してほしい番号 (1-based, -1=全再送)
  file_name?: string;
  message?: string;
};

export const uploadServerResponseSamples = {
  issueOperation: <UploadServerIssueResponse>{ operation_id: 'op_1234567890', status: 'start' },
  uploadDoing: <UploadServerDoingResponse>{ status: 'doing', operation_id: 'op_1234567890', number: 2 },
  uploadNeedReupload: <UploadServerDoingResponse>{
    status: 'end',
    operation_id: 'op_1234567890',
    number: 3,
    file_name: 'image_003.jpg',
    message: 'Please re-upload #3',
  },
  completeOk: <UploadServerEndResponse>{ status: 'end', operation_id: 'op_1234567890', sum_number: 30 },
  completeError: <UploadServerEndResponse>{
    status: 'error',
    operation_id: 'op_1234567890',
    number: -1,
    file_name: 'all',
    message: 'Checksum mismatch, please re-upload all files',
  },
};
