import React from 'react';
import { Link } from 'react-router-dom';

export const HubScreen: React.FC = () => {
  const PERSIST_KEY = 'upload_state_v1';
  const raw = window.localStorage.getItem(PERSIST_KEY);
  console.log("[画面スタート]", "ローカルストレージ：", raw)

  return (
    <div className="page">
      <h1 style={{ marginTop: 0 }}>検図検証プロジェクト</h1>
      <p>用途に合わせて画面を選択してください。</p>

      <div style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f8fafc', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>ラベル付与</h2>
              <p style={{ margin: '4px 0 0' }}>図面をアップロードし、ラベル付与した図面とCSVファイルが出力されます</p>
            </div>
            <Link className="primary" to="/create-label">開く</Link>
          </div>
        </section>
      </div>
    </div>
  );
};
