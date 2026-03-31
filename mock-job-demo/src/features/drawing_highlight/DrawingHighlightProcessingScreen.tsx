import React from 'react'

export const DrawingHighlightProcessingScreen: React.FC = () => {

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>図面ハイライトの処理中</h2>
      </div>
      <p>現在図面ハイライトの処理中です。<br />完了までしばらくお待ちください。</p>

    </div>

  );
};
