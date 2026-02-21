import {
  Client,
  AccountId,
  PrivateKey,
  TokenAssociateTransaction,
  TransferTransaction,
  TokenMintTransaction,
  TopicMessageSubmitTransaction,
  TokenId,
  TopicId,
  NftId,
} from '@hashgraph/sdk';
import { config } from '../config';
import fs from 'fs';
import { generateNftSvg } from './nftImage';
import { uploadSvgToIpfs, uploadMetadataToIpfs } from './pinata';

// ─── State ──────────────────────────────────────────────────────────────────

interface HederaState {
  workTokenId: string;
  identityNftTokenId: string;
  jobTopicId: string;
  reputationTopicId: string;
  operatorId: string;
}

function loadState(): HederaState {
  // Prefer env vars (Railway/production) over the local state file
  if (process.env.HEDERA_WORK_TOKEN_ID) {
    return {
      workTokenId:         process.env.HEDERA_WORK_TOKEN_ID!,
      identityNftTokenId:  process.env.HEDERA_IDENTITY_NFT_TOKEN_ID!,
      jobTopicId:          process.env.HEDERA_JOB_TOPIC_ID!,
      reputationTopicId:   process.env.HEDERA_REPUTATION_TOPIC_ID!,
      operatorId:          config.hedera.operatorId,
    };
  }
  const raw = fs.readFileSync(config.stateFile, 'utf-8');
  return JSON.parse(raw);
}

// ─── Key Parsing ────────────────────────────────────────────────────────────

function parsePrivateKey(keyStr: string): PrivateKey {
  // Try ECDSA first (0x-prefixed hex keys from portal)
  try {
    return PrivateKey.fromStringECDSA(keyStr);
  } catch {}
  // Try ED25519
  try {
    return PrivateKey.fromStringED25519(keyStr);
  } catch {}
  // Try DER-encoded
  try {
    return PrivateKey.fromStringDer(keyStr);
  } catch {}
  throw new Error(`Could not parse private key (tried ECDSA, ED25519, DER)`);
}

// ─── Client ─────────────────────────────────────────────────────────────────

function getClient(): Client {
  const client = Client.forTestnet();
  const operatorId = AccountId.fromString(config.hedera.operatorId);
  const operatorKey = parsePrivateKey(config.hedera.operatorKey);
  client.setOperator(operatorId, operatorKey);
  return client;
}

function getOperatorKey(): PrivateKey {
  return parsePrivateKey(config.hedera.operatorKey);
}

// ─── Token Association ──────────────────────────────────────────────────────

/**
 * Try executing a transaction that requires an agent signature.
 * Attempts ECDSA first, then ED25519, since both key types are 32 bytes
 * and cannot be distinguished by format alone.
 */
async function executeWithAgentKey(
  client: Client,
  buildTx: () => Promise<any>,
  agentPrivateKey: string,
  label: string
): Promise<any> {
  const keyParsers = [
    { name: 'ECDSA', parse: () => PrivateKey.fromStringECDSA(agentPrivateKey) },
    { name: 'ED25519', parse: () => PrivateKey.fromStringED25519(agentPrivateKey) },
  ];

  for (const { name, parse } of keyParsers) {
    try {
      const agentKey = parse();
      const tx = await buildTx();
      const frozen = await tx.freezeWith(client);
      const signed = await frozen.sign(agentKey);
      const response = await signed.execute(client);
      const receipt = await response.getReceipt(client);
      console.log(`${label} succeeded with ${name} key`);
      return receipt;
    } catch (err: any) {
      const msg = err.message || err.toString();
      if (msg.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        console.log(`${label}: already associated, skipping`);
        return null;
      }
      if (msg.includes('INVALID_SIGNATURE')) {
        console.log(`${label} failed with ${name} key (INVALID_SIGNATURE), trying next...`);
        continue;
      }
      throw err; // different error, don't retry
    }
  }
  throw new Error(`${label}: all key types failed (INVALID_SIGNATURE)`);
}

export async function associateAgentWithTokens(
  agentAccountId: string,
  agentPrivateKey: string
): Promise<void> {
  const client = getClient();
  const state = loadState();

  const agentId = AccountId.fromString(agentAccountId);
  const workTokenId = TokenId.fromString(state.workTokenId);
  const nftTokenId = TokenId.fromString(state.identityNftTokenId);

  await executeWithAgentKey(
    client,
    () => Promise.resolve(
      new TokenAssociateTransaction()
        .setAccountId(agentId)
        .setTokenIds([workTokenId, nftTokenId])
    ),
    agentPrivateKey,
    `Associate ${agentAccountId} with WORK + AGID`
  );

  console.log(`Associated ${agentAccountId} with WORK + AGID tokens`);
  client.close();
}

// ─── Token Transfers ────────────────────────────────────────────────────────

export async function transferTokens(
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<string> {
  const client = getClient();
  const state = loadState();
  const workTokenId = TokenId.fromString(state.workTokenId);

  const tx = await new TransferTransaction()
    .addTokenTransfer(workTokenId, AccountId.fromString(fromAccountId), -amount)
    .addTokenTransfer(workTokenId, AccountId.fromString(toAccountId), amount)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const txId = tx.transactionId.toString();
  console.log(`Transferred ${amount} WORK: ${fromAccountId} → ${toAccountId} (tx: ${txId})`);
  client.close();
  return txId;
}

// Escrow: poster → operator treasury
export async function escrowTokens(
  posterAccountId: string,
  amount: number
): Promise<string> {
  return transferTokens(posterAccountId, config.hedera.operatorId, amount);
}

// Release: operator treasury → worker
export async function releaseEscrow(
  workerAccountId: string,
  amount: number
): Promise<string> {
  return transferTokens(config.hedera.operatorId, workerAccountId, amount);
}

// Distribute initial tokens to agent from treasury
export async function distributeTokens(
  agentAccountId: string,
  amount: number
): Promise<string> {
  return transferTokens(config.hedera.operatorId, agentAccountId, amount);
}

// ─── NFT Minting ────────────────────────────────────────────────────────────

export async function mintIdentityNft(
  metadata: {
    name: string;
    role: string;
    skills: string[];
    registered: string;
  },
  agentAccountId: string,
  agentId: string
): Promise<number> {
  const client = getClient();
  const state = loadState();
  const nftTokenId = TokenId.fromString(state.identityNftTokenId);

  // Upload SVG image and HIP-412 metadata JSON to IPFS via Pinata.
  // Falls back to server-hosted URL if PINATA_JWT is not set.
  let metadataUri = `${config.serverUrl}/nft/agent/${agentId}`;
  try {
    const svg = generateNftSvg({
      name: metadata.name,
      role: metadata.role,
      skills: metadata.skills,
      hederaAccountId: agentAccountId,
      registeredAt: metadata.registered,
    });
    const imageUri = await uploadSvgToIpfs(svg, metadata.name);
    const metadataJson = {
      name: `${metadata.name} — Colony Agent`,
      description: `${metadata.role} on the Colony autonomous agent marketplace. Skills: ${metadata.skills.join(', ')}.`,
      image: imageUri,
      properties: {
        role: metadata.role,
        skills: metadata.skills,
        hedera_account: agentAccountId,
        registered_at: metadata.registered,
      },
    };
    metadataUri = await uploadMetadataToIpfs(metadataJson, metadata.name);
    console.log(`IPFS metadata: ${metadataUri}`);
    console.log(`IPFS image:    ${imageUri}`);
  } catch (err: any) {
    console.warn(`Pinata upload failed, falling back to server URL: ${err.message}`);
  }

  const metadataBytes = Buffer.from(metadataUri.slice(0, 100));
  console.log(`NFT metadata URI: ${metadataUri} (${metadataBytes.length} bytes)`);

  const mintTx = await new TokenMintTransaction()
    .setTokenId(nftTokenId)
    .addMetadata(metadataBytes)
    .execute(client);

  const receipt = await mintTx.getReceipt(client);
  const serial = receipt.serials[0].toNumber();
  console.log(`Minted AGID NFT #${serial} for ${metadata.name}`);

  // Transfer NFT from operator treasury to the agent's account.
  // Requires the agent to have pre-associated the AGID token.
  try {
    const transferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(nftTokenId, serial),
        AccountId.fromString(config.hedera.operatorId),
        AccountId.fromString(agentAccountId)
      )
      .execute(client);
    await transferTx.getReceipt(client);
    console.log(`Transferred AGID NFT #${serial} to ${agentAccountId}`);
  } catch (err: any) {
    console.warn(`Could not transfer AGID NFT #${serial} to ${agentAccountId}: ${err.message}`);
    // Agent likely hasn't pre-associated the AGID token — NFT stays in treasury.
    // Serial is still stored so the agent can claim it after associating.
  }

  client.close();
  return serial;
}

// ─── HCS Attestations ──────────────────────────────────────────────────────

export async function submitJobAttestation(
  message: {
    type: 'job_posted' | 'job_assigned' | 'job_completion' | 'job_rejected';
    job_id: string;
    poster: string;
    worker?: string;
    bounty: number;
    rating?: number;
    payment_tx?: string;
    timestamp: string;
  }
): Promise<number> {
  const client = getClient();
  const state = loadState();
  const topicId = TopicId.fromString(state.jobTopicId);

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(message))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const seqNum = receipt.topicSequenceNumber!.toNumber();
  console.log(`HCS Job Attestation #${seqNum}: ${message.type} for ${message.job_id}`);
  client.close();
  return seqNum;
}

export async function submitReputationFeedback(
  message: {
    type: 'reputation_feedback';
    agent_id: string;
    reviewer_id: string;
    score: number;
    tags: string[];
    review: string;
    job_id: string;
  }
): Promise<number> {
  const client = getClient();
  const state = loadState();
  const topicId = TopicId.fromString(state.reputationTopicId);

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(message))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const seqNum = receipt.topicSequenceNumber!.toNumber();
  console.log(`HCS Reputation #${seqNum}: score ${message.score} for ${message.agent_id}`);
  client.close();
  return seqNum;
}

// ─── Reputation Reading (Mirror Node) ───────────────────────────────────────

export async function getReputationScores(agentId: string): Promise<{
  averageScore: number;
  totalReviews: number;
  tags: Record<string, number>;
}> {
  const state = loadState();
  const topicId = state.reputationTopicId;

  try {
    const response = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=100`
    );
    const data: any = await response.json();

    let totalScore = 0;
    let count = 0;
    const tags: Record<string, number> = {};

    for (const msg of data.messages || []) {
      try {
        const decoded = JSON.parse(
          Buffer.from(msg.message, 'base64').toString('utf-8')
        );
        if (decoded.type === 'reputation_feedback' && decoded.agent_id === agentId) {
          totalScore += decoded.score;
          count++;
          for (const tag of decoded.tags || []) {
            tags[tag] = (tags[tag] || 0) + 1;
          }
        }
      } catch {
        // skip malformed messages
      }
    }

    return {
      averageScore: count > 0 ? Math.round(totalScore / count) : 50,
      totalReviews: count,
      tags,
    };
  } catch (err) {
    console.error('Failed to read reputation from mirror node:', err);
    return { averageScore: 50, totalReviews: 0, tags: {} };
  }
}

// ─── Export state helper ────────────────────────────────────────────────────

export function getHederaState(): HederaState {
  return loadState();
}
