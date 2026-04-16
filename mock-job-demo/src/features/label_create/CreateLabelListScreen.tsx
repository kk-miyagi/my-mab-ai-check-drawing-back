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
  CheckCircleOutlineOutlined,
  ChevronRight,
  Create,
  Error,
  Schedule
} from '@mui/icons-material';
import { Header } from '../../components/Header';

type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

interface ProcessItem {
  title: string;
  modelName: string;
  fileName: string;
  createdAt: string;
  status: ProcessStatus;
  isComplete: boolean;
}

const MOCK_DATA: ProcessItem[] = [
  {title: '部品Aの図面', modelName: 'FC-901SN', fileName: 'TKE-000004', createdAt: '2026-04-01 09:00', status: 'doing', isComplete: false},
  {title: '部品Aの図面', modelName: 'FC-901SN', fileName: 'TKE-000003', createdAt: '2026-04-01 09:00', status: 'doing', isComplete: false},
  {title: '部品Bの図面', modelName: 'FC-801SN', fileName: 'TKE-000015', createdAt: '2026-03-31 17:00', status: 'end', isComplete: false},
  {title: '部品Cの図面', modelName: 'FC-701SN', fileName: 'TKE-000021', createdAt: '2026-03-30 12:00', status: 'end', isComplete: true},
  {title: '部品Dの図面', modelName: 'FC-601SN', fileName: 'TKE-000032', createdAt: '2026-03-30 11:30', status: 'end', isComplete: true}
]


type StatusConfig = {
  label: string;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
  icon: React.ReactElement;
  sx?: object;
};

const NavigateButton: React.FC<{ status: ProcessStatus, isComlete: boolean }> = ({ status, isComlete }) => {
  if (status === 'start' || status === 'doing' || status === 'error') {
    return;
  }
  const config = {
    end: isComlete ? {label: '詳細', icon: <ChevronRight />} : {label: '編集', icon: <Create />}
  }
  const { label, icon } = config[status];
  return(
    <Button variant="outlined" color='inherit'>{icon}{label}</Button>
  );
}

const StatusBadge: React.FC<{ status: ProcessStatus, isComlete: boolean }> = ({ status, isComlete }) => {
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
    end: isComlete
      ? {
          label: '完了',
          color: 'success',
          icon: <CheckCircle />,
        }
      : {
          label: '編集待ち',
          color: 'warning',
          icon: <CheckCircleOutlineOutlined />,
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

export const CreateLabelListScreen: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box>
      <Header />
      <Container>
        <h1>ラベル付与</h1>
        <h2>処理一覧</h2>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>タイトル</TableCell>
                <TableCell>機種名</TableCell>
                <TableCell>ファイル名</TableCell>
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
                  <TableCell>{row.fileName}</TableCell>
                  <TableCell>{row.createdAt}</TableCell>
                  <TableCell><StatusBadge status={row.status} isComlete={row.isComplete} /></TableCell>
                  <TableCell><NavigateButton status={row.status} isComlete={row.isComplete} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </Box>
  );
}
