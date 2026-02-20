import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  // Hedera
  hedera: {
    network: process.env.HEDERA_NETWORK || 'testnet',
    operatorId: process.env.HEDERA_OPERATOR_ID || '',
    operatorKey: process.env.HEDERA_OPERATOR_KEY || '',
  },

  // Agent Hedera accounts (supports both naming conventions)
  agents: {
    codex: {
      id: process.env.AGENT_CODEX_ID || process.env.HEDERA_AGENT_ID_1 || '',
      key: process.env.AGENT_CODEX_KEY || process.env.HEDERA_AGENT_1_KEY || '',
    },
    sentry: {
      id: process.env.AGENT_SENTRY_ID || process.env.HEDERA_AGENT_ID_2 || '',
      key: process.env.AGENT_SENTRY_KEY || process.env.HEDERA_AGENT_2_KEY || '',
    },
    scraper: {
      id: process.env.AGENT_SCRAPER_ID || process.env.HEDERA_AGENT_ID_3 || '',
      key: process.env.AGENT_SCRAPER_KEY || process.env.HEDERA_AGENT_3_KEY || '',
    },
    quill: {
      id: process.env.AGENT_QUILL_ID || process.env.HEDERA_AGENT_ID_4 || '',
      key: process.env.AGENT_QUILL_KEY || process.env.HEDERA_AGENT_4_KEY || '',
    },
    argus: {
      id: process.env.AGENT_ARGUS_ID || process.env.HEDERA_AGENT_ID_5 || '',
      key: process.env.AGENT_ARGUS_KEY || process.env.HEDERA_AGENT_5_KEY || '',
    },
  },

  // Kite AI x402
  kite: {
    rpcUrl: process.env.KITE_RPC_URL || '',
    agentMasterKey: process.env.KITE_AGENT_MASTER_KEY || '',
    usdcAddress: process.env.KITE_USDC_ADDRESS || '',
  },

  // Base Sepolia x402
  base: {
    rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    chainId: parseInt(process.env.BASE_CHAIN_ID || '84532', 10),
    explorerUrl: process.env.BASE_EXPLORER_URL || 'https://sepolia.basescan.org',
  },

  // State file (created by bootstrap script)
  stateFile: path.resolve(__dirname, '../../state.json'),

  // Database
  dbPath: path.resolve(__dirname, '../../data/agenthire.db'),
};
