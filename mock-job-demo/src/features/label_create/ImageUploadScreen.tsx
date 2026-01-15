import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUpload } from '../../components/upload/UploadContext.tsx';
import { useEpicInit } from '../../hooks/useEpicInit';

const DEFAULT_EPIC = 'label-create';
const DEFAULT_OPERATION = 'labeling';

export const ImageUploadScreen: React.FC = () => {
  const { startUpload } = useUpload();
  const [file, setFile] = React.useState<File[]>([]);
  const [preview, setPreview] = React.useState<string | null>(null);

  const handleSetFile = (e:React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setFile([selectedFile]);
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setFile([]);
      setPreview(null);
    }
  };

  const handleStart = async () => {
    // if (!file) {
    //   alert('画像を選択してください。');
    //   return;
    // }
    // const formData = new FormData();
    // const response = await fetch('', {method: 'POST', body: formData})



    // 元々の実装。これで呼べるがこのままの実装だとアップロードで止まってしまうため、一旦↑に書く。その後、汎用部分は分割するイメージで。
    await startUpload(file, {
      epic: DEFAULT_EPIC,
      operation: DEFAULT_OPERATION,
    });
  }

  const navigate = useNavigate();
  const { sendEnd, error: initError } = useEpicInit(DEFAULT_EPIC);

  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>ラベル付与</h1>
        <Link to="/hub" onClick={async (e) => {e.preventDefault();await sendEnd();navigate('/hub');}}>前に戻る</Link>
      </div>
      {initError && <p style={{ color: 'red' }}>初期化エラー: {initError}</p>}
      <p>ID発行 → アップロード → 最終確認の流れで送信します。</p>
      <ul>
        <li>想定: 1MB程度の画像を1枚送信</li>
        <li>毎リクエストに user / epic / operation / operation_id / status を付与</li>
        <li>ステータス: start (ID発行), doing (送信中), end (完了 or 再送指示)</li>
      </ul>
      <div style={{ display: 'grid', gap: 4, margin: '12px 0' }}>
        <div><strong>epic:</strong> {DEFAULT_EPIC}</div>
        <div><strong>operation:</strong> {DEFAULT_OPERATION}</div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'grid', gap: 10,}}>
          <label style={{ display: 'grid', gap: 4 }}>
            <input type="file" accept="image/*" onChange={handleSetFile} />
          </label>
        </div>
      </div>

      {preview && (
        <div style={{ marginBottom: '15px' }}>
          <img src={preview} alt='プレビュー' style={{ width: '100%', maxHeight: '2000px', objectFit: 'contain' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button className="primary" onClick={handleStart}  disabled={file.length === 0}>処理開始</button>
      </div>

    </div>
  );
};
