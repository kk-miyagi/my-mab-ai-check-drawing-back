import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { ChevronRight, Create } from '@mui/icons-material';
import { UpdateLabelInitRequest, UpdateLabelRequest } from '../../types/createLabel';
import { updateLabelInit } from '../../hooks/updateLabelInit';
import { StatusList, StatusBadge } from '../../components/StatusList';
import type { StatusListResponse, Status } from '../../types/statusList';

const NavigateButton: React.FC<{ row: StatusListResponse }> = ({ row }) => {
  if(!row.operations || row.operations.length === 0) {
    return null;
  }
  const navigate = useNavigate();
  const t : UpdateLabelInitRequest = {
    user: row.user,
    epic: row.epic,
    group_id: row.group_id,
    group_status: row.group_status,
    others: row.others,
    operations: [{ operation: "update-label-init", operation_id: row.operations[0].operation_id, status: "start" }]
  }
  const handleClick = async () => {
    await updateLabelInit(
      t,
      navigate,
      "/update-label"
    );
  };
  const status = row.group_status as Status;
  if (status === 'start' || status === 'doing' || status === 'error') {
    return;
  }
  if (status === 'end') {
    const nav =  () => handleClick();
    const icon = <Create />;
    const label = '編集';
    return (
      <Button variant="outlined" color='inherit' onClick={nav}>{icon}{label}</Button>
    )
  }
  if (status === 'comp') {
    const updateLabelPayload : UpdateLabelRequest = {
      user: row.user,
      epic: row.epic,
      group_id: row.group_id,
      group_status: row.group_status,
      others: row.others,
      operations: [{ operation: "update-label", operation_id: row.operations[0].operation_id, status: "end" }]
    }
    const nav = () => navigate('/create-label-result', { state: { updateLabelPayload }});
    const icon = <ChevronRight />;
    const label = '詳細';
    return (
      <Button variant="outlined" color='inherit' onClick={nav}>{icon}{label}</Button>
    )
  }
}

export const CreateLabelListScreen: React.FC = () => {
  const columns: Array<{
    id: string;
    label: string;
    render: (row?: StatusListResponse) => React.ReactNode;
  }> = [
    { id: 'title', label: 'タイトル', render: (r) => r?.others.title },
    { id: 'modelName', label: '機種名', render: (r) => r?.others.modelName },
    { id: 'fileName', label: 'ファイル名', render: (r) => r?.others.fileName },
    { id: 'createdAt', label: '開始時間', render: (r) => r?.create_time },
    {
      id: 'status',
      label: 'ステータス',
      render: (r) => <StatusBadge status={(r as StatusListResponse).group_status} epic="create-label" />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton row={r as StatusListResponse} />,
    },
  ];

  return (
    <StatusList epic="create-label" title="ラベル付与" columns={columns} />
  );
}
