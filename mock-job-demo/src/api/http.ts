import axios from 'axios';
//サーバー側に送るための設定とaxiosインスタンスの作成
const baseURL = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '';

export const http = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 120000, // allow large batches/uploads without premature timeout
});
