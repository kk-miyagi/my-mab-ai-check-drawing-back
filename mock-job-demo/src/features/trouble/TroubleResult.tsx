import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { Header } from '../../components/Header';

export const TroubleResult: React.FC = () => {
  const location = useLocation();
  const { state } = location;
  const res = state.res;
  const searchItems = res.others.search_items as Record<string, string>;

  const muiComponents = {
    h1: ({ children }: any) =>  (
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          mt: 4,
          mb: 2,
          pb: 1,
          borderBottom: '2px solid',
          borderColor: 'primary.light',
          color: 'text.primary',
        }}
      >
        {children}
      </Typography>
    ),
    h2: ({ children }: any) => (
      <Typography
        variant="h5"
        gutterBottom
        sx={{
            mt: 3,
            mb: 2,
            pb: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            color: 'text.primary',
        }}
      >
        {children}
      </Typography>
    ),
    h3: ({ children }: any) => (
      <Typography
        variant="h6"
        gutterBottom
      >
        {children}
      </Typography>
    ),
    p: ({ children }: any) => (
      <Typography
        variant="body1"
      >
        {children}
      </Typography>
    ),
    ul: ({ children }: any) => (
      <Box
        component="ul"
        sx={{
          pl: 4,
          mb: 2
        }}
      >
        {children}
      </Box>
    ),
    li: ({ children }: any) => (
      <Typography
        component="li"
      >
        {children}
      </Typography>
    ),
    strong: ({ children }: any) => (
      <Typography
        component="span"
        sx={{ fontWeight: 'bold' }}
      >
        {children}
      </Typography>
    ),
  }

  return (
    <Box>
      <Header />
      <Container>
        <Stack spacing={2} sx={{ py: 2 }}>
          <Typography variant='h4'>過去トラブル結果</Typography>
          {Object.entries(searchItems).map(([key, value]) => (
            <ReactMarkdown
              key={key}
              children={value}
              components={muiComponents}
            />
          ))}
        </Stack>
      </Container>  
    </Box>
  )
}
