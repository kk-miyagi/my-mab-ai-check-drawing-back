import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Autorenew,
  CheckCircle,
  ChevronRight,
  Error,
  Schedule
} from '@mui/icons-material';
import { Header } from '../../components/Header';

type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

interface ProcessItem {
  title: string;
  modelName: string;
  createdAt: string;
  status: ProcessStatus;
}

const MOCK_DATA: ProcessItem[] = [
  {title: '図面Eと自社図面2枚との比較', modelName: 'FC-901SN', createdAt: '2026-04-01 09:30', status: 'doing'},
  {title: '図面Dと自社図面1枚との比較', modelName: 'FC-901SN', createdAt: '2026-04-01 09:00', status: 'doing'},
  {title: '図面Cと自社図面3枚との比較', modelName: 'FC-701SN', createdAt: '2026-03-31 17:00', status: 'end'},
  {title: '図面Bと自社図面1枚との比較', modelName: 'FC-601SN', createdAt: '2026-03-30 12:00', status: 'end'},
  {title: '図面Aと自社図面1枚との比較', modelName: 'FC-501SN', createdAt: '2026-03-30 11:30', status: 'end'}
]

type StatusConfig = {
  label: string;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
  icon: React.ReactElement;
  sx?: object;
};

const NavigateButton: React.FC<{ status: ProcessStatus }> = ({ status }) => {
  if (status === 'start' || status === 'doing' || status === 'error') {
    return;
  }
  const config = {
    end: {label: '詳細', icon: <ChevronRight />}
  }
  const { label, icon } = config[status];
  return(
    <Button variant="outlined" color='inherit'>{icon}{label}</Button>
  );
}

const StatusBadge: React.FC<{ status: ProcessStatus }> = ({ status }) => {
  const config: Record<ProcessStatus, StatusConfig> = {
    start: {
      label: '開始',
      icon: <Schedule />,
    },
    doing: {
      label: '実行中',
      color: 'info',
      icon: <Autorenew />,
    },
    end: {
      label: '完了',
      color: 'success',
      icon: <CheckCircle />,
    },
    error: {
      label: 'エラー',
      color: 'error',
      icon: <Error />,
    },
  };


  const { label, color, icon, sx } = config[status];

  return (
    <Chip
      icon={icon}
      label={label}
      color={color}
      variant={sx ? 'outlined' : 'filled'}
    />
  );

}

export const DrawingCompareListScreen: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box>
      <Header />
      <Container>
        <h1>図面比較</h1>
        <h2>処理一覧</h2>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>タイトル</TableCell>
                <TableCell>機種名</TableCell>
                <TableCell>開始時間</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_DATA.map((row) => (
                <TableRow key={row.title}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.modelName}</TableCell>
                  <TableCell>{row.createdAt}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell><NavigateButton status={row.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </Box>
  );
}
