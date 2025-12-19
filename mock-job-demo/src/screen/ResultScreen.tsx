import React from 'react';
import { useUpload } from './UploadContext';

export const ResultScreen: React.FC = () => {
  const { resultData, reset, logs, operationId, failedUploads, startUpload } = useUpload();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [stagedFiles, setStagedFiles] = React.useState<File[]>([]);

  const addFiles = (incoming: File[], allowed: string[]) => {
    const filtered = incoming.filter((f) => allowed.includes(f.name));
    if (filtered.length === 0) return;
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const merged = [...prev];
      filtered.forEach((f) => {
        if (!existingNames.has(f.name)) merged.push(f);
      });
      return merged;
    });
  };

  if (!resultData && logs.length === 0) {
    return (
      <div className="page">
        <p>データがありません。最初からやり直してください。</p>
        <button onClick={reset}>トップに戻る</button>
      </div>
    );
  }

  const hasFailures = (failedUploads?.length ?? 0) > 0 || resultData?.status === 'error';
  const isSuccess = !hasFailures && resultData?.status === 'end' && (resultData.number === undefined || resultData.number === null);

  return (
    <div className="page">
      <h1 className={isSuccess ? 'success' : 'error'}>{isSuccess ? '完了' : '確認が必要'}</h1>
      {operationId && <p>operation_id: {operationId}</p>}

      {isSuccess ? (
        <p>アップロード完了。sum_number: {resultData?.sum_number}</p>
      ) : (
        <p>サーバーから再送指示がありました。</p>
      )}

      {hasFailures && (
        <div style={{ marginTop: 16 }}>
          <h3>再送が必要なファイル</h3>
          <p>以下の番号/ファイルを再送してください。</p>
          <ul>
            {failedUploads?.map((item) => (
              <li key={item.number}>
                #{item.number}: {item.fileNames.join(', ')} {item.reason ? `- ${item.reason}` : ''}
              </li>
            ))}
          </ul>
          <p>該当ファイルのみ再送してください（それ以外は送信不可）。</p>

          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const allowed = failedUploads?.flatMap((f) => f.fileNames) ?? [];
              const files = Array.from(e.dataTransfer.files || []);
              const invalid = files.filter((f) => !allowed.includes(f.name)).map((f) => f.name);
              if (invalid.length > 0) {
                window.alert(`許可されていないファイルが含まれています: ${invalid.join(', ')}`);
                return;
              }
              addFiles(files, allowed);
            }}
            style={{
              border: '2px dashed #94a3b8',
              padding: '16px',
              borderRadius: 12,
              marginTop: 8,
              background: '#f8fafc',
            }}
          >
            <p style={{ margin: 0 }}>ここにドラッグ＆ドロップ、または下のボタンで追加</p>
            <div style={{ marginTop: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const allowed = failedUploads?.flatMap((f) => f.fileNames) ?? [];
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length === 0) return;
                  const invalid = files.filter((f) => !allowed.includes(f.name)).map((f) => f.name);
                  if (invalid.length > 0) {
                    window.alert(`許可されていないファイルが含まれています: ${invalid.join(', ')}`);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                  }
                  addFiles(files, allowed);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>再送選択中: {stagedFiles.length} 件</strong>
            {stagedFiles.length > 0 && (
              <div style={{ maxHeight: 140, overflowY: 'auto', marginTop: 6, border: '1px solid #e5e7eb', padding: 8, borderRadius: 8 }}>
                {stagedFiles.map((f) => (
                  <div key={f.name} style={{ fontSize: '0.95rem' }}>{f.name}</div>
                ))}
              </div>
            )}
          </div>

          <button
            className="primary"
            style={{ marginTop: 8 }}
            onClick={() => {
              const allowed = failedUploads?.flatMap((f) => f.fileNames) ?? [];
              const invalid = stagedFiles.filter((f) => !allowed.includes(f.name)).map((f) => f.name);
              if (invalid.length > 0) {
                window.alert(`許可されていないファイルが含まれています: ${invalid.join(', ')}`);
                return;
              }
              if (stagedFiles.length > 0) {
                startUpload(stagedFiles, { allowedFileNames: allowed, isRetry: true });
                setStagedFiles([]);
              }
            }}
            disabled={stagedFiles.length === 0}
          >
            再送を開始
          </button>
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                const allowed = failedUploads?.flatMap((f) => f.fileNames) ?? [];
                const stored = failedUploads?.flatMap((f) => f.files ?? []) ?? [];
                if (stored.length === 0) {
                  window.alert('保持している再送用ファイルがありません。ファイルを選択してください。');
                  return;
                }
                const unique = stored.reduce<File[]>((acc, file) => {
                  if (!acc.find((f) => f.name === file.name && f.lastModified === file.lastModified)) {
                    acc.push(file);
                  }
                  return acc;
                }, []);
                startUpload(unique, { allowedFileNames: allowed, isRetry: true });
              }}
            >
              保持済みのファイルで再送
            </button>
          </div>
        </div>
      )}

      {resultData?.number !== undefined && !hasFailures && (
        <p>再送番号: {resultData.number} {resultData.file_name ? `(file: ${resultData.file_name})` : ''}</p>
      )}

      {resultData?.message && <p>Message: {resultData.message}</p>}

      <button onClick={reset} style={{ marginTop: 16 }}>最初に戻る</button>
    </div>
  );
};
