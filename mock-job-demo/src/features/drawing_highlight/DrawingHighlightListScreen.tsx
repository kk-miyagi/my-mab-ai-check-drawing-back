import React from 'react';
import {
  Button,
  Chip,
} from '@mui/material';
import {
  Autorenew,
  CheckCircle,
  ChevronRight,
  Error,
  Schedule
} from '@mui/icons-material';
import { StatusList } from '../../components/StatusList';

type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

interface ProcessItem {
  title: string;
  modelName: string;
  createdAt: string;
  status: ProcessStatus;
}

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

export const DrawingHighlightListScreen: React.FC = () => {
  const columns: Array<{
    id: string;
    label: string;
    render: (row?: ProcessItem) => React.ReactNode;
  }> = [
    { id: 'title', label: 'タイトル', render: (r) => r?.title },
    { id: 'modelName', label: '機種名', render: (r) => r?.modelName },
    { id: 'createdAt', label: '開始時間', render: (r) => r?.createdAt },
    {
      id: 'status',
      label: 'ステータス',
      render: (r) => <StatusBadge status={(r as ProcessItem).status} />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton status={(r as ProcessItem).status} />,
    },
  ];
  return (
    <StatusList epic="drawing-highlight" title="差分ハイライト" columns={columns} />
  );
}
