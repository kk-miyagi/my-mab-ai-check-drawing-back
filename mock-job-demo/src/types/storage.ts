export type LocalStorageData = {
  user: string;
  epic: string;
  operation: string;
  operationId: string | null;
  status: 'start' | 'doing' | 'end' | 'error';
};

// LocalStorageDataのバージョン2。↑を上書きすると既存コードが動かなくなるため、新しく定義する。
// なお、既存コードが全て改修できたら↑は削除してLocalStorageDataV2をLocalStorageDataにリネームする想定。
export type LocalStorageDataV2 = {
  user: string;
  group_id: string;
  status: 'start' | 'doing' | 'end' | 'error';
};
