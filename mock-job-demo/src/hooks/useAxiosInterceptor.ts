import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { http } from '../api/http';

export const useAxiosInterceptor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const responseInterceptor = http.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;

        let errorMessage = '';
        switch (status) {
          case 401:
            errorMessage = 'ユーザーが見つかりませんでした。';
            navigate('/login', { state: { errorMessage } });
            break;
          case 403:
            errorMessage = '認証に失敗しました。再度ログインしてください。';
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
  }, [navigate]);
};
