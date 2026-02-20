import express from 'express';
import cors from 'cors';
import { config } from './config';
import { agentRoutes } from './routes/agents';
import { jobRoutes } from './routes/jobs';
import { serviceRoutes } from './routes/services';
import { eventsRouter, broadcastEvent } from './routes/events';
import { nftRoutes } from './routes/nft';

// Initialize database (runs schema creation on import)
import './db';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/agents', agentRoutes);
app.use('/jobs', jobRoutes);
app.use('/services', serviceRoutes);
app.use('/events', eventsRouter);
app.use('/nft', nftRoutes);

// UCP well-known manifest
app.get('/.well-known/ucp.json', (_req, res) => {
  const state = loadState();
  res.json({
    name: 'AgentHire Marketplace',
    description: 'Agent-to-agent freelance marketplace on Hedera',
    capabilities: [
      {
        type: 'dev.agenthire.hiring',
        version: '1.0',
        transport: 'rest',
        endpoint: '/ucp/hiring',
      },
    ],
    payment_handlers: [
      {
        type: 'hedera_hts',
        token_id: state?.workTokenId || '',
        symbol: 'WORK',
      },
    ],
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(config.port, () => {
  console.log(`\n=== AgentHire Server ===`);
  console.log(`Listening on port ${config.port}`);
  console.log(`Health: http://localhost:${config.port}/health`);
  console.log(`Events: http://localhost:${config.port}/events`);
  console.log(`========================\n`);
});

// Helper to load state.json
function loadState(): any {
  try {
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(config.stateFile, 'utf-8'));
  } catch {
    return null;
  }
}

export { app, broadcastEvent };
