import React from 'react';
import { Link } from 'react-router-dom';
import { localStorageKey } from '../constants/localStorageKey';

export const HubScreen: React.FC = () => {
  const raw = window.localStorage.getItem(localStorageKey.default);
  console.log("[画面スタート]", "ローカルストレージ：", raw)
  console.log("[画面スタート]", "drawローカルストレージ:", window.localStorage.getItem(localStorageKey.drawingReview))

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
            <Link className="primary" to="/update-label">編集する</Link>
            <Link className="primary" to="/demo-create-label">デモを開く</Link>
          </div>
        </section>

        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f8fafc', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>図面比較</h2>
              <p style={{ margin: '4px 0 0' }}>図面の変更前後の差分をハイライト</p>
            </div>
            {/* <Link className="primary" to="/drawing-compare-upload">開く</Link> */}
            <Link className="primary" to="/drawing-compare-upload-base">開く</Link>
          </div>
        </section>

        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f8fafc', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>図面審査</h2>
              <p style={{ margin: '4px 0 0' }}>図面審査シートの指摘内容の反映チェック</p>
            </div>
            <Link className="primary" to="/drawing-review-upload-excel">開く</Link>
          </div>
        </section>

      </div>
    </div>
  );
};
