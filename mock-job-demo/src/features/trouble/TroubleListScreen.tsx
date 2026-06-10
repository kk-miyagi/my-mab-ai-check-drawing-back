import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { StatusList, StatusBadge } from '../../components/StatusList';
import type { StatusListResponse, Status } from '../../types/statusList';
import { troubleApi } from '../../api/troubleApi';
import type { TroubleRequest } from '../../types/trouble';

const NavigateButton: React.FC<{ row: StatusListResponse }> = ({ row }) => {
  if(!row.operations || row.operations.length === 0) {
    return null;
  }
  const navigate = useNavigate();
  const status = row.group_status as Status;
  if (status === 'start' || status === 'doing' || status === 'error') {
    return null;
  }
  if (status === 'end') {
    const payload: TroubleRequest = {
      user: row.user,
      epic: row.epic,
      group_id: row.group_id,
      group_status: row.group_status,
      others: row.others,
      operations: [{
        operation: 'trouble-search',
        operation_id: row.operations[0].operation_id,
        status: 'end'
      }],
    };
    const handleClick = async () => {
      const res = await troubleApi.trouble(payload);
      navigate('/trouble-result', { state: { res }});
    }
    const icon = <ChevronRight />;
    const label = '詳細';
    return (
      <Button variant="outlined" color='inherit' onClick={handleClick}>{icon}{label}</Button>
    )
  }
}

export const TroubleListScreen: React.FC = () => {
  const columns: Array<{
    id: string;
    label: string;
    render: (row?: StatusListResponse) => React.ReactNode;
  }> = [
    { id: 'searchKey', label: '部品名(大区分)', render: (r) => r?.others.search_keys.join(', ') },
    { id: 'createdAt', label: '開始時間', render: (r) => r?.create_time },
    {
      id: 'status',
      label: 'ステータス',
      render: (r) => <StatusBadge status={(r as StatusListResponse).group_status} epic="trouble-search" />,
    },
    {
      id: 'action',
      label: '操作',
      render: (r) => <NavigateButton row={r as StatusListResponse} />,
    },
  ];

  return (
    <StatusList epic="trouble-search" title="過去トラブル検索" subtitle="検索一覧" columns={columns} />
  );
}
