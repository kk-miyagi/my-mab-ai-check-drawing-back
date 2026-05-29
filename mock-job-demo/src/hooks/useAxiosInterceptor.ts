import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from './useAuth';

export const useAxiosInterceptor = () => {
  const navigate = useNavigate();
  const { logout }  = useAuth();

  useEffect(() => {
    const responseInterceptor = http.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;

        let errorMessage = '';
        switch (status) {
          case 400:
            logout();
            errorMessage = 'セッションが無効です。再度ログインしてください。';
            navigate('/login', { state: { errorMessage } });
            break;
          case 401:
            logout();
            errorMessage = 'ユーザーが見つかりませんでした。';
            navigate('/login', { state: { errorMessage } });
            break;
          case 403:
            logout();
            errorMessage = '認証に失敗しました。再度ログインしてください。';
            navigate('/login', { state: { errorMessage } });
            break;
          case 503:
            logout();
            errorMessage = 'サービスが利用できません。しばらくしてから再度お試しください。';
            navigate('/login', { state: { errorMessage } });
            break;
          default:
            break;
        }

        return Promise.reject(error);
      }
    );

    return () => {
      http.interceptors.response.eject(responseInterceptor);
    };
  }, [navigate, logout]);
};
