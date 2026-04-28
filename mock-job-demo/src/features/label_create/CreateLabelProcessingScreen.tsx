import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { localStorageKey } from '../../constants/localStorageKey';
import { LocalStorageDataV2 } from '../../types/storage.ts';
import { NavigateState } from '../../types/createLabel.ts';
import { CheckStatusResponse } from '../../types/checkStatus.ts';
import { checkStatusApi } from '../../api/checkStatusApi.ts';
import { useLocalStorageArray } from '../../hooks/useLocalStorageArray.ts';
import { Header } from '../../components/Header';
import {
  Box,
  Button,
  Chip,
  Container,
  Typography,
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
  CheckCircleOutlineOutlined,
  Error,
  Schedule
} from '@mui/icons-material';



type ProcessStatus = 'start' | 'doing' | 'end' | 'error' | string;

export type Operations = {
  operation: string;
  operation_id: string;
  status: ProcessStatus;
}
interface ProcessItem {
  user: string;
  epic: string;
  group_id: string;
  group_status: 'start' | 'doing' | 'end' | string;
  others: Record<string, string>;
  operations: Operations[];
  fileName: string;
}


type StatusConfig = {
  label: string;
  color?: 'default' | 'info' | 'success' | 'error' | 'warning';
  icon: React.ReactElement;
  sx?: object;
};

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
          label: 'ラベル付与完了',
          color: 'success',
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

export const CreateLabelProcessingScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { requests: NavigateState[] };
  const requests = state.requests;

  const { updateItem } = useLocalStorageArray<LocalStorageDataV2>(localStorageKey.createLabel);

  // 実行中の情報
  const [processItems, setProcessItems] = useState<ProcessItem[]>([]);

  // 画面遷移時に値をセットする
  useEffect(() => {
    const items = requests.map((request) => ({
      user: request.user,
      epic: request.epic,
      group_id: request.group_id,
      group_status: request.group_status,
      others: request.others,
      operations: request.operations,
      fileName: request.fileName,
    }));
    setProcessItems(items);
  }, [requests]);

  // processItems の最新値を ref で保持
  const processItemsRef = useRef<ProcessItem[]>([]);
  useEffect(() => {
    processItemsRef.current = processItems;
  }, [processItems]);

  // updateItem の最新版も ref に逃がす（依存を切るため）
  const updateItemRef = useRef(updateItem);
  useEffect(() => {
    updateItemRef.current = updateItem;
  }, [updateItem]);

  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  // ポーリングは「マウント時 1 回だけ」起動
  useEffect(() => {
    let timerId: number | null = null;
    let cancelled = false;
    const inFlight = { current: false };

    const tick = async () => {
      if (cancelled || inFlight.current) {
        scheduleNext();
        return;
      }
      inFlight.current = true;

      try {
        const current = processItemsRef.current;
        const targets = current.filter(
          (x) => x.group_status !== 'end' && x.group_status !== 'error'
        );

        // 全件完了したらポーリング停止
        if (targets.length === 0) return;

        const results = await Promise.allSettled(
          targets.map((item) => {
            const controller = new AbortController();
            controllersRef.current.set(item.group_id, controller);

            return checkStatusApi
              .checkStatus(
                {
                  user: item.user,
                  epic: item.epic,
                  group_id: item.group_id,
                  group_status: item.group_status,
                  others: item.others,
                  operations: item.operations,
                },
                controller.signal
              )
              .finally(() => {
                controllersRef.current.delete(item.group_id);
              });
          })
        );

        // アンマウント後の state 更新を防止
        if (cancelled) return;

        if (results.every((r) => r.status === 'rejected')) {
          window.alert('全てのAPIリクエストが失敗しました。時間をおいて再度お試しください。');
          navigate('/create-label')
          return;
        }

        const byGroupId = new Map<string, CheckStatusResponse>();
        results.forEach((r) => {
          if (r.status === 'fulfilled') byGroupId.set(r.value.group_id, r.value);
        });

        setProcessItems((prev) =>
          prev.map((item) => {
            const res = byGroupId.get(item.group_id);
            if (!res) return item;

            if (res.group_status === 'end' || res.group_status === 'error') {
              updateItemRef.current(
                (ls) => ls.group_id === res.group_id,
                { user: res.user, group_id: res.group_id, status: res.group_status }
              );
            }

            return {
              ...item,
              group_status: res.group_status
            };
          })
        );
      } finally {
        inFlight.current = false;
        scheduleNext();
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      timerId = window.setTimeout(tick, 5000);
    };

    // 最初の一回（即時実行したくないなら scheduleNext() に変更）
    tick();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };
  }, []); // ← 空配列でマウント時のみ起動

  return (
    <Box>
      <Header />
      <Container>
        <Typography variant="h4" gutterBottom>
          ラベル付与処理中
        </Typography>
        <Typography variant="body1" color="text.secondary">
          現在以下のラベル付与を実行しています。<br />処理結果については、右のボタンの「ラベル付与の一覧画面へ」よりご確認ください。
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: 2 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/create-label-list')}
          >
            ラベル付与の一覧画面へ
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>ステータス</TableCell>
                <TableCell>タイトル</TableCell>
                <TableCell>機種名</TableCell>
                <TableCell>ファイル名</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processItems.map((row) => (
                <TableRow key={row.group_id}>
                  <TableCell><StatusBadge status={row.group_status} /></TableCell>
                  <TableCell>{row.others.title}</TableCell>
                  <TableCell>{row.others.modelName}</TableCell>
                  <TableCell>{row.fileName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </Box>
  );
};
