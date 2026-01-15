import React from 'react';
import { Link } from 'react-router-dom';

export const HubScreen: React.FC = () => {
  return (
    <div className="page">
      <h1 style={{ marginTop: 0 }}>検図検証プロジェクト</h1>
      <p>用途に合わせて画面を選択してください。</p>

      <div style={{ display: 'grid', gap: 14, maxWidth: 720 }}>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            background: '#f8fafc',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>ラベル付与</h2>
              <p style={{ margin: '4px 0 0' }}>図面をアップロードし、ラベル付与した図面とCSVファイルが出力されます</p>
            </div>
            <Link className="primary" to="/label-create-step1">開く</Link>
          </div>
        </section>

        {/* <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            background: '#f8fafc',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>CSV + 画像 (1:1)</h2>
              <p style={{ margin: '4px 0 0' }}>1つのCSVと1つの画像をペアで送信します。</p>
            </div>
            <Link className="primary" to="/label-create">開く</Link>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>順番は CSV → 画像 で送信</li>
            <li>ファイルが両方そろってから送信可能</li>
          </ul>
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>複数画像アップロード</h2>
              <p style={{ margin: '4px 0 0' }}>既存の複数画像アップロードフローです。</p>
            </div>
            <Link className="primary" to="/cheking-drawings">開く</Link>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>2枚1組で並列送信</li>
            <li>ID発行 → 送信 → 最終確認の流れ</li>
          </ul>
        </section> */}
      </div>
    </div>
  );
};
