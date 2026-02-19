/**
 * AgentHire Bootstrap Script
 *
 * Creates on Hedera testnet:
 * 1. WORK token (HTS Fungible) — internal economy currency
 * 2. AGID token (HTS NFT) — agent identity collection
 * 3. Job Attestation Topic (HCS) — job lifecycle attestations
 * 4. Reputation Topic (HCS) — agent reputation feedback
 *
 * Saves all created IDs to state.json
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TopicCreateTransaction,
} from '@hashgraph/sdk';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

async function bootstrap() {
  console.log('=== AgentHire Bootstrap ===\n');

  // Validate config
  if (!config.hedera.operatorId || !config.hedera.operatorKey) {
    console.error('ERROR: HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env');
    process.exit(1);
  }

  // Check if state already exists
  if (fs.existsSync(config.stateFile)) {
    const existing = JSON.parse(fs.readFileSync(config.stateFile, 'utf-8'));
    console.log('State file already exists:');
    console.log(JSON.stringify(existing, null, 2));
    console.log('\nDelete state.json to re-run bootstrap.');
    return;
  }

  // Initialize Hedera client
  const operatorId = AccountId.fromString(config.hedera.operatorId);
  let operatorKey: PrivateKey;
  try {
    operatorKey = PrivateKey.fromStringECDSA(config.hedera.operatorKey);
  } catch {
    try {
      operatorKey = PrivateKey.fromStringED25519(config.hedera.operatorKey);
    } catch {
      operatorKey = PrivateKey.fromStringDer(config.hedera.operatorKey);
    }
  }

  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  console.log(`Operator: ${operatorId.toString()}`);
  console.log(`Network: testnet\n`);

  // ─── 1. Create WORK Token (HTS Fungible) ─────────────────────────────────

  console.log('1. Creating WORK token (HTS Fungible)...');
  const workTokenTx = await new TokenCreateTransaction()
    .setTokenName('AgentHire Work Token')
    .setTokenSymbol('WORK')
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(100000)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(operatorId)
    .setAdminKey(operatorKey)
    .setSupplyKey(operatorKey)
    .execute(client);

  const workTokenReceipt = await workTokenTx.getReceipt(client);
  const workTokenId = workTokenReceipt.tokenId!;
  console.log(`   WORK Token ID: ${workTokenId.toString()}`);
  console.log(`   Initial Supply: 100,000 WORK`);
  console.log(`   View: https://hashscan.io/testnet/token/${workTokenId.toString()}\n`);

  // ─── 2. Create Identity NFT Collection (HTS NFT) ─────────────────────────

  console.log('2. Creating AGID identity NFT collection (HTS NFT)...');
  const nftTx = await new TokenCreateTransaction()
    .setTokenName('AgentHire Identity')
    .setTokenSymbol('AGID')
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(operatorId)
    .setAdminKey(operatorKey)
    .setSupplyKey(operatorKey)
    .execute(client);

  const nftReceipt = await nftTx.getReceipt(client);
  const nftTokenId = nftReceipt.tokenId!;
  console.log(`   AGID NFT Token ID: ${nftTokenId.toString()}`);
  console.log(`   View: https://hashscan.io/testnet/token/${nftTokenId.toString()}\n`);

  // ─── 3. Create Job Attestation Topic (HCS) ───────────────────────────────

  console.log('3. Creating Job Attestation Topic (HCS)...');
  const jobTopicTx = await new TopicCreateTransaction()
    .setTopicMemo('AgentHire Job Attestations')
    .setSubmitKey(operatorKey)
    .execute(client);

  const jobTopicReceipt = await jobTopicTx.getReceipt(client);
  const jobTopicId = jobTopicReceipt.topicId!;
  console.log(`   Job Topic ID: ${jobTopicId.toString()}`);
  console.log(`   View: https://hashscan.io/testnet/topic/${jobTopicId.toString()}\n`);

  // ─── 4. Create Reputation Topic (HCS) ────────────────────────────────────

  console.log('4. Creating Reputation Topic (HCS)...');
  const repTopicTx = await new TopicCreateTransaction()
    .setTopicMemo('AgentHire Reputation')
    .setSubmitKey(operatorKey)
    .execute(client);

  const repTopicReceipt = await repTopicTx.getReceipt(client);
  const repTopicId = repTopicReceipt.topicId!;
  console.log(`   Reputation Topic ID: ${repTopicId.toString()}`);
  console.log(`   View: https://hashscan.io/testnet/topic/${repTopicId.toString()}\n`);

  // ─── Save State ───────────────────────────────────────────────────────────

  const state = {
    workTokenId: workTokenId.toString(),
    identityNftTokenId: nftTokenId.toString(),
    jobTopicId: jobTopicId.toString(),
    reputationTopicId: repTopicId.toString(),
    operatorId: operatorId.toString(),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
  console.log('=== Bootstrap Complete ===');
  console.log(`State saved to ${config.stateFile}`);
  console.log(JSON.stringify(state, null, 2));

  client.close();
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
