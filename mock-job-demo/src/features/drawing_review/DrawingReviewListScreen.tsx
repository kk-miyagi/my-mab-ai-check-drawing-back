import React from 'react';
import { Button } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { StatusList, StatusBadge } from '../../components/StatusList';

type ProcessStatus = 'start' | 'doing' | 'end' | 'error';

interface ProcessItem {
  title: string;
  modelName: string;
  createdAt: string;
  status: ProcessStatus;
}

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

export const DrawingReviewListScreen: React.FC = () => {
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
      render: (r) => <StatusBadge status={(r as ProcessItem).status} epic="drawing-review" />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton status={(r as ProcessItem).status} />,
    },
  ];
  return (
    <StatusList epic="drawing-review" title="図面審査" columns={columns} />
  );
}
