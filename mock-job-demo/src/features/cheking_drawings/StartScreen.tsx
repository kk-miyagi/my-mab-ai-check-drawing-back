import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUpload } from '../../components/upload/UploadContext.tsx';
import { useEpicInit } from '../../hooks/useEpicInit';
import { issueOperationId } from '../../components/upload/issueOperationId';

const DEFAULT_EPIC = (import.meta.env?.VITE_UPLOAD_EPIC as string | undefined) ?? 'drawing-comparison';
const DEFAULT_OPERATION = (import.meta.env?.VITE_UPLOAD_OPERATION as string | undefined) ?? 'multi-file-upload';

export const StartScreen: React.FC = () => {
  const { startUpload } = useUpload();
  const [stagedFiles, setStagedFiles] = React.useState<File[]>([]);
  const navigate = useNavigate();
  const { sendEnd, error: initError } = useEpicInit(DEFAULT_EPIC);

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const merged = [...prev];
      incoming.forEach((f) => {
        if (!existingNames.has(f.name)) merged.push(f);
      });
      return merged;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    addFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    addFiles(files);
  };

  const testIssueId = async () => {
    const payload = {
      user: (import.meta.env?.VITE_UPLOAD_USER as string | undefined) ?? 'demo-user',
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
      operation_id: null,
      status: 'start' as const,
    };
    try {
      const res = await issueOperationId(payload);
      window.alert(`発行成功: operation_id=${res.operation_id}`);
      console.info('[id-test] success', res);
    } catch (err: any) {
      window.alert(`発行失敗: ${err?.message ?? 'unknown error'}`);
      console.error('[id-test] error', err);
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>画像アップロード開始</h1>
        <Link
          to="/hub"
          onClick={async (e) => {
            e.preventDefault();
            await sendEnd();
            navigate('/hub');
          }}
        >
          ハブへ戻る
        </Link>
      </div>
      {initError && <p style={{ color: 'red' }}>初期化エラー: {initError}</p>}
      <p>ID発行 → 並列アップロード → 最終確認の流れで送信します。</p>
      <ul>
        <li>想定: 1MB程度の画像を60枚、2枚1組で送信</li>
        <li>毎リクエストに user / epic / operation / operation_id / status を付与</li>
        <li>ステータス: start (ID発行), doing (送信中), end (完了 or 再送指示)</li>
      </ul>
      <div style={{ display: 'grid', gap: 4, margin: '12px 0' }}>
        <div><strong>epic:</strong> {DEFAULT_EPIC}</div>
        <div><strong>operation:</strong> {DEFAULT_OPERATION}</div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        style={{
          border: '2px dashed #94a3b8',
          padding: '20px',
          borderRadius: 12,
          marginBottom: 12,
          background: '#f8fafc',
        }}
      >
        <p style={{ margin: 0 }}>ここにドラッグ＆ドロップ、または下のボタンで追加</p>
        <div style={{ marginTop: 8 }}>
          <input type="file" multiple accept="image/*" onChange={handleFileChange} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>選択中: {stagedFiles.length} 件</strong>
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
        onClick={() => {
          if (stagedFiles.length === 0) return;
          startUpload(stagedFiles);
          setStagedFiles([]);
        }}
        disabled={stagedFiles.length === 0}
      >
        アップロードを開始
      </button>
      <div style={{ marginTop: 8 }}>
        <button onClick={testIssueId}>ID発行だけ試す</button>
      </div>
      <p className="note">デフォルトではモック送信。VITE_USE_MOCK_API=false でサーバーへ送信。</p>
    </div>
  );
};
