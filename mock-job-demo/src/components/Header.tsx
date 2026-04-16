import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Container,
  IconButton,
  Toolbar,
  Typography
} from '@mui/material';
import {
  Home
} from '@mui/icons-material';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AppBar position="static"sx={{backgroundColor: '#0166B3', boxShadow: 'none'}}>
      <Toolbar variant="dense">
        <Container sx={{ display: 'flex', alignItems: 'center'}}>
          <IconButton edge="start" color="inherit" aria-label="home" onClick={() => navigate('/')}>
            <Home />
          </IconButton>
          <Typography variant="h6" component="div">
            検図アプリ
          </Typography>
        </Container>
      </Toolbar>
    </AppBar>
  );
}
