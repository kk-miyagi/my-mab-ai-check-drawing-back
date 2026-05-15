import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { ChevronRight, Create } from '@mui/icons-material';
import { UpdateLabelInitRequest } from '../../types/createLabel';
import { updateLabelInit } from '../../hooks/updateLabelInit';
import { StatusList, StatusBadge } from '../../components/StatusList';

type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

interface ProcessItem {
  title: string;
  modelName: string;
  fileName: string;
  createdAt: string;
  status: ProcessStatus;
  isComplete: boolean;
}

const NavigateButton: React.FC<{ status: ProcessStatus, isComplete: boolean }> = ({ status, isComplete }) => {
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
    end: isComplete ? {label: '詳細', icon: <ChevronRight />, nav: () => navigate('/create-label-list')} : {label: '編集', icon: <Create />, nav: () => handleClick()}
  }
  const { label, icon, nav } = config[status];
  return(
    <Button variant="outlined" color='inherit' onClick={nav}>{icon}{label}</Button>
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
      render: (r) => <StatusBadge status={(r as ProcessItem).status} epic="create-label" isComplete={(r as ProcessItem).isComplete} />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton status={(r as ProcessItem).status} isComplete={(r as ProcessItem).isComplete} />,
    },
  ];

  return (
    <StatusList epic="create-label" title="ラベル付与" columns={columns} />
  );
}
