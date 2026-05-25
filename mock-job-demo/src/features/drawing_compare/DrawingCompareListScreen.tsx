import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { StatusList, StatusBadge } from '../../components/StatusList';
import type { StatusListResponse, Status } from '../../types/statusList';
import type { DrawingCompareRequest } from '../../types/drawingCompare';

const NavigateButton: React.FC<{ row: StatusListResponse }> = ({ row }) => {
  if(!row.operations || row.operations.length === 0) {
    return null;
  }
  const navigate = useNavigate();
  const status = row.group_status as Status;
  if (status === 'start' || status === 'doing' || status === 'error') {
    return;
  }
  if (status === 'end') {
    const drawingComparePayload : DrawingCompareRequest = {
      user: row.user,
      epic: row.epic,
      group_id: row.group_id,
      group_status: row.group_status,
      others: row.others,
      operations: row.operations.map(op => ({
        operation: "batch-drawing-compare",
        operation_id: op.operation_id,
        status: "end",
      })),
    }
    const nav = () => navigate('/drawing-compare-result', { state: { drawingComparePayload }});
    const icon = <ChevronRight />;
    const label = '詳細';
    return (
      <Button variant="outlined" color='inherit' onClick={nav}>{icon}{label}</Button>
    )
  }
}

export const DrawingCompareListScreen: React.FC = () => {
  const columns: Array<{
    id: string;
    label: string;
    render: (row?: StatusListResponse) => React.ReactNode;
  }> = [
    { id: 'title', label: 'タイトル', render: (r) => r?.others.title },
    { id: 'modelName', label: '機種名', render: (r) => r?.others.modelName },
    { id: 'createdAt', label: '開始時間', render: (r) => r?.create_time },
    {
      id: 'status',
      label: 'ステータス',
      render: (r) => <StatusBadge status={(r as StatusListResponse).group_status} epic="drawing-compare" />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton row={r as StatusListResponse} />,
    },
  ];
  return (
    <StatusList epic="drawing-compare" title="図面比較" columns={columns} />
  );
}
