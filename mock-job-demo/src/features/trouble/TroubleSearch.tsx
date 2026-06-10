import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Header } from '../../components/Header';
import { troubleApi } from '../../api/troubleApi';
import type { TroubleRequest } from '../../types/trouble';
import type { OperationIssueRequest } from '../../types/uploadServer.ts';
import { issueOperationIdApi } from '../../api/issueOperationIdApi.ts';
import { groupIdApi } from '../../api/groupIdApi.ts';
import { useAuth } from '../../hooks/useAuth.ts';

export const TroubleSearch: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return null;
  }
  const [troubles, setTroubles] = useState<string[]>([]);
  const [selectedTroubles, setSelectedTroubles] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleSearch = async () => {
    const groupIdPayload = {
      user: user,
      epic: 'trouble-search',
      group_id: 'init',
      group_status: 'start',
      others: {},
      operations: [{ operation: '', operation_id: '', status: '' }],
    };
    const groupIdResponse = await groupIdApi(groupIdPayload);
    const groupId = groupIdResponse.group_id;

    const operationIdPayload: OperationIssueRequest = {
      user: user,
      epic: 'trouble-search',
      group_id: groupId,
      group_status: 'start',
      others: {},
      operations: [{ operation: 'trouble-search', operation_id: '', status: 'start' }]
    };
    const operationIdResponse = await issueOperationIdApi(operationIdPayload);
    const operationId = operationIdResponse.operations[0].operation_id;
    if (!operationId) {
      return null;
    }

    const payload: TroubleRequest = {
      user: user,
      epic: 'trouble-search',
      group_id: groupId,
      group_status: 'doing',
      others: {
        search_keys: selectedTroubles,
      },
      operations: [
        {
          operation: 'trouble-search',
          operation_id: operationId,
          status: 'doing',
        }
      ],
    };
    const res = await troubleApi.trouble(payload);
    if (res) {
      navigate('/trouble-result', { state: { res } });
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const payload: TroubleRequest = {
          user: user,
          epic: 'trouble-search',
          group_id: 'trouble-search-init',
          group_status: 'start',
          others: {},
          operations: [
            {
              operation: 'trouble-search-init',
              operation_id: 'trouble-search-init',
              status: 'start',
            }
          ],
        }

        const res = await troubleApi.troubleInit(payload);
        setTroubles(res.others.search_keys);
      } catch (error) {
        console.error('トラブル検索の初期化に失敗', error);
        setTroubles([]);
      }
    })()
  }, [])

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
        <Typography variant='h4'>過去トラブル検索</Typography>
        <Typography variant='body1' sx={{mt: 2}}>過去のトラブル事例を検索して確認します。</Typography>
        {troubles.length > 0 ? (
          <>
           <Autocomplete
            multiple
            options={troubles}
            value={selectedTroubles}
            onChange={(_event, newValue) => setSelectedTroubles(newValue)}
            renderInput={(params) => (
              <TextField {...params} label="部品名(大区分)" />
            )}
          />
          <Button
            variant='contained'
            onClick={handleSearch}
          >
            検索
          </Button>
          </>
        ) : (
          <Typography variant='body1' sx={{mt: 2}}>トラブル事例がありません。</Typography>
        )}
         
        </Stack>
      </Container>  
    </Box>
  )
}