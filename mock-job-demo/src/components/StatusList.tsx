import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Stack
} from '@mui/material';
import { Header } from './Header';
import { statusListApi } from '../api/statusListApi';

type StatusListProps = {
  epic: string;
  title: string;
  columns: Array<{
    id: string;
    label: string;
    render: (item: any) => React.ReactNode;
  }>
}

export const StatusList: React.FC<StatusListProps> = ({ epic, title, columns }) => {
  const [items, setItems] = useState<any[]>([]);
  const [snackOpen, setSnackOpen] = useState(false);

  const fetchData = async () => {
    const payload = {
      user: "demo-user",
      epic: epic,
      group_id: "demo-group-id",
      group_status: "start",
      others: {},
      operations: [
        { operation: "status-list", operation_id: "", status: "start" },
      ],
    };
    const res = await statusListApi.getStatusListMock(payload);
    if (epic === "create-label") {
      setItems(
        res.others.status_list.map((item: any) => ({
          title: item.title,
          modelName: item.modelName,
          fileName: item.fileName,
          createdAt: item.createdAt,
          status: item.status,
          isComplete: item.isComplete,
        }))
      );
    }
    if (epic === "drawing-review") {
      setItems(
        res.others.status_list.map((item: any) => ({
          title: item.title,
          modelName: item.modelName,
          createdAt: item.createdAt,
          status: item.status,
          isComplete: item.isComplete,
        }))
      );
    }
    if (epic === "drawing-highlight") {
      setItems(
        res.others.status_list.map((item: any) => ({
          title: item.title,
          modelName: item.modelName,
          createdAt: item.createdAt,
          status: item.status,
          isComplete: item.isComplete,
        }))
      );
    }
    if (epic === "drawing-compare") {
      setItems(
        res.others.status_list.map((item: any) => ({
          title: item.title,
          modelName: item.modelName,
          createdAt: item.createdAt,
          status: item.status,
          isComplete: item.isComplete,
        }))
      );
    }
  };
  const handleSnackClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackOpen(false);
  };
  useEffect(() => {
    fetchData();
  }, []);
  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant="h4">{title}</Typography>
          <Typography variant="h5" sx={{ mt: 2 }}>処理一覧</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" size="small" onClick={() => { fetchData(); setSnackOpen(true); }}>一覧を更新</Button>
          </Box>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  {columns.map((c) => (
                    <TableCell key={c.id}>{c.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center">データがありません</TableCell>
                  </TableRow>
                )}
                {items.map((row) => (
                  <TableRow key={row.title}>
                    {columns.map((c) => (
                      <TableCell key={c.id}>{c.render(row)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Snackbar open={snackOpen} autoHideDuration={3000} onClose={handleSnackClose} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
            <Alert onClose={handleSnackClose} severity="success" sx={{ width: '100%' }}>
              更新しました
            </Alert>
          </Snackbar>
        </Stack>
      </Container>
    </Box>
  )
}