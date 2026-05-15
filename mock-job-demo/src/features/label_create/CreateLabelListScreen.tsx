import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
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
import { UpdateLabelInitRequest } from '../../types/createLabel';
import { updateLabelInit } from '../../hooks/updateLabelInit';
import { StatusList } from '../../components/StatusList';

type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

interface ProcessItem {
  title: string;
  modelName: string;
  fileName: string;
  createdAt: string;
  status: ProcessStatus;
  isComplete: boolean;
}

type StatusConfig = {
  label: string;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
  icon: React.ReactElement;
  sx?: object;
};

const NavigateButton: React.FC<{ status: ProcessStatus, isComlete: boolean }> = ({ status, isComlete }) => {
  const navigate = useNavigate();
  const t : UpdateLabelInitRequest = {
    user: "demo-user",
    epic: "create-label",
    operation: "update-label-init",
    operation_id: "0cee10ef-d568-4839-bf72-8511a3dd9813",
    status: "start"
  }
  const handleClick = async () => {
    await updateLabelInit(
      t,
      navigate,
      "/update-label"
    );
  };
  if (status === 'start' || status === 'doing' || status === 'error') {
    return;
  }
  const config = {
    end: isComlete ? {label: '詳細', icon: <ChevronRight />, nav: () => navigate('/create-label-list')} : {label: '編集', icon: <Create />, nav: () => handleClick()}
  }
  const { label, icon, nav } = config[status];
  return(
    <Button variant="outlined" color='inherit' onClick={nav}>{icon}{label}</Button>
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
  const columns: Array<{
    id: string;
    label: string;
    render: (row?: ProcessItem) => React.ReactNode;
  }> = [
    { id: 'title', label: 'タイトル', render: (r) => r?.title },
    { id: 'modelName', label: '機種名', render: (r) => r?.modelName },
    { id: 'fileName', label: 'ファイル名', render: (r) => r?.fileName },
    { id: 'createdAt', label: '開始時間', render: (r) => r?.createdAt },
    {
      id: 'status',
      label: 'ステータス',
      render: (r) => <StatusBadge status={(r as ProcessItem).status} isComlete={(r as ProcessItem).isComplete} />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton status={(r as ProcessItem).status} isComlete={(r as ProcessItem).isComplete} />,
    },
  ];

  return (
    <StatusList epic="create-label" title="ラベル付与" columns={columns} />
  );
}
