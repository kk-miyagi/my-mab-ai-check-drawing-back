import { FormEvent, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Container,
  Typography,
  TextField,
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.errorMessage || '';
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (message) {
      setErrorMessage(message);
    }
  }, [location.key, message]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const req = {
        user: user,
        epic: 'login',
        group_id: 'login-group-id',
        group_status: 'start',
        others: { user: user, password: password },
        operations: [{ operation: 'login', operation_id: '', status: 'start' }]
      }
      await login(req);
      navigate('/')
    } catch (error) {
      // エラーハンドリングはuseAxiosInterceptorで行うため、ここでは特に処理しない
    }
  }

  return (
    <Box>
      <Header />
      <Container>
        <Typography variant="h4">ログイン</Typography>

        {errorMessage && (
            <Alert severity='error'>
              <AlertTitle>エラー</AlertTitle>
              {errorMessage}
            </Alert>
        )}

        <TextField
          label="ユーザーID"
          fullWidth
          margin="normal"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <TextField
          label="パスワード"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button variant="contained" color="primary" fullWidth onClick={handleSubmit}>
          ログイン
        </Button>

      </Container>
    </Box>
  )
}