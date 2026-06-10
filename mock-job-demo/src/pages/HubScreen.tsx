import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header.tsx'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Grid,
  Stack,
  SvgIcon,
  Typography
} from '@mui/material';
import {
  Add,
  Brush,
  Compare,
  Label,
  List,
  Rule,
  Search,
} from '@mui/icons-material';

type feature = {
  id: string;
  title: string;
  descripttion: string;
  icon: typeof SvgIcon;
  color: string;
  accentColor: string;
  onNew: () => void;
  onList: () => void;
}

export const HubScreen: React.FC = () => {

  const navigate = useNavigate();

  const features: feature[] = [
    {
      id: "label",
      title: "ラベル付与",
      descripttion: "図面から設計情報を抽出して図面にラベル付けします。",
      icon: Label,
      color: "#E6F1FB",
      accentColor: "#185FA5",
      onNew: () => navigate('/create-label'),
      onList: () => navigate('/create-label-list')
    },
    {
      id: "compare",
      title: "図面比較",
      descripttion: "客先図面と自社図面の設計情報の比較をします。",
      icon: Compare, color: "#E1F5EE",
      accentColor: "#0F6E56",
      onNew: () => navigate('/drawing-compare-upload-base'),
      onList: () => navigate('/drawing-compare-list')
    },
    {
      id: "highlight",
      title: "差分ハイライト",
      descripttion: "変更前後の図面を画像認識で比較し、差分をハイライトします。",
      icon: Brush,
      color: "#FAECE7",
      accentColor: "#993C1D",
      onNew: () => navigate('/drawing-highlight-upload-before'),
      onList: () => navigate('/drawing-highlight-list')
    },
    {
      id: "review",
      title: "図面審査",
      descripttion: "図面審査シートの指摘内容が反映されているかチェックします。",
      icon: Rule,
      color: "#FAEEDA",
      accentColor: "#854F0B",
      onNew: () => navigate('/drawing-review-upload-excel'),
      onList: () => navigate('/drawing-review-list')
    },
    {
      id: "trouble",
      title: "過去トラブル検索",
      descripttion: "過去のトラブル事例を検索して確認します。",
      icon: Search,
      color: "#F3E9FF",
      accentColor: "#6B46C1",
      onNew: () => navigate('/trouble-search'),
      onList: () => navigate('/trouble-list')
    }
  ]

  return (
    <Box>
      <Header />
      <Container>
        <h1>ダッシュボード</h1>
        <p>業務用途に合わせて選択してください</p>
        <Box sx={{ width: '100%'}}>
          <Grid container spacing={2} columns={{xs: 4, sm: 8, md: 16}}>
            {features.map((f) =>{
              const IconComponent = f.icon;
              return (
                <Grid size={{xs: 4, md: 8}} key={f.id}>
                  <Card
                    sx={{
                      borderRadius:3
                    }}
                  >
                    <CardContent>
                      <Stack direction='row' spacing={2}>
                        <Box sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          bgcolor: f.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <IconComponent sx={{ color: f.accentColor, gap: 4 }} />
                        </Box>
                        <Box>
                          <Typography variant='h5' sx={{ fontWeight: 'bold' }}>{f.title}</Typography>
                          <Typography variant='caption'>{f.descripttion}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                    <CardActions sx={{ml: 2, gap: 1}}>
                      <Button variant='contained' startIcon={f.id === 'trouble' ? <Search /> : <Add />} onClick={f.onNew}>{f.id === 'trouble' ? '検索' : '新規'}</Button>
                      <Button variant='outlined' startIcon={<List />} onClick={f.onList}>一覧</Button>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};
