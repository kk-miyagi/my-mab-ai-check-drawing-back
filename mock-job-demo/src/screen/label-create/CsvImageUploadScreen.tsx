import React from 'react';
import { Link } from 'react-router-dom';
import { useUpload } from '../utils/UploadContext.tsx';

type Pair = {
  id: string;
  csv?: File;
  image?: File;
};

const EPIC = 'label-create';
const OPERATION = 'multi-file-upload';

const createEmptyPair = (): Pair => ({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });

export const CsvImageUploadScreen: React.FC = () => {
  const { startUpload } = useUpload();
  const [pairs, setPairs] = React.useState<Pair[]>([createEmptyPair()]);

  const setFile = (id: string, kind: 'csv' | 'image', file?: File) => {
    setPairs((prev) => prev.map((p) => (p.id === id ? { ...p, [kind]: file } : p)));
  };

  const addPair = () => setPairs((prev) => [...prev, createEmptyPair()]);

  const removePair = (id: string) => {
    setPairs((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  const handleStart = async () => {
    const incomplete = pairs.filter((p) => !p.csv || !p.image);
    if (pairs.length === 0 || pairs.every((p) => !p.csv && !p.image)) {
      window.alert('送信する組を追加してください。');
      return;
    }
    if (incomplete.length > 0) {
      window.alert('CSVと画像の両方がそろった組のみ送信できます。未選択の組を削除するか、ファイルを指定してください。');
      return;
    }

    const files: File[] = [];
    pairs.forEach((p) => {
      if (p.csv) files.push(p.csv);
      if (p.image) files.push(p.image);
    });

    await startUpload(files, {
      epic: EPIC,
      operation: OPERATION,
    });
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>CSV + 画像 アップロード</h1>
        <Link to="/hub">ハブへ戻る</Link>
      </div>
      <p>CSVと画像を1:1で複数組まとめて送信します（順序はCSV→画像）。</p>

      <div style={{ display: 'grid', gap: 6, maxWidth: 520, marginBottom: 12 }}>
        <div><strong>epic:</strong> {EPIC}</div>
        <div><strong>operation:</strong> {OPERATION}</div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {pairs.map((pair, idx) => (
          <div
            key={pair.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 12,
              background: '#f8fafc',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>組 #{idx + 1}</strong>
              <button onClick={() => removePair(pair.id)} disabled={pairs.length === 1}>削除</button>
            </div>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>CSVファイル</span>
              <input type="file" accept=".csv" onChange={(e) => setFile(pair.id, 'csv', e.target.files?.[0])} />
              {pair.csv && <div style={{ fontSize: '0.95rem' }}>{pair.csv.name}</div>}
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>画像ファイル</span>
              <input type="file" accept="image/*" onChange={(e) => setFile(pair.id, 'image', e.target.files?.[0])} />
              {pair.image && <div style={{ fontSize: '0.95rem' }}>{pair.image.name}</div>}
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button onClick={addPair}>＋ 組を追加</button>
        <button
          className="primary"
          onClick={handleStart}
          disabled={pairs.length === 0 || pairs.every((p) => !p.csv || !p.image)}
        >
          送信する
        </button>
      </div>

      <p className="note" style={{ marginTop: 12 }}>
        CSV→画像の順でサーバーへ送信します。各組は2ファイル1組として扱われます。
      </p>
    </div>
  );
};
