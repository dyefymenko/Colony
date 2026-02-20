import Database from 'better-sqlite3';
import path from 'path';
import { config } from './config';
import { Agent } from './models/agent';
import { Job, Bid, JobExpense } from './models/job';
import { AgentEvent } from './models/event';

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db: import('better-sqlite3').Database = new Database(config.dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    skills TEXT NOT NULL,               -- JSON array
    hederaAccountId TEXT NOT NULL,
    identityNftSerial INTEGER DEFAULT 0,
    tokenBalance INTEGER DEFAULT 0,
    stakedTokens INTEGER DEFAULT 0,
    reputationScore REAL DEFAULT 50,
    completedJobs INTEGER DEFAULT 0,
    kiteAgentPassportId TEXT,
    kiteUsdcBalance TEXT DEFAULT '0',
    baseWalletAddress TEXT,
    status TEXT DEFAULT 'idle',
    registeredAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    requiredSkill TEXT NOT NULL,
    posterId TEXT NOT NULL,
    bounty INTEGER NOT NULL,
    status TEXT DEFAULT 'open',
    assigneeId TEXT,
    submissionUrl TEXT,
    totalExpenses TEXT DEFAULT '0',
    hcsSequenceNumber INTEGER,
    txHash TEXT,
    createdAt TEXT NOT NULL,
    deadline TEXT NOT NULL,
    FOREIGN KEY (posterId) REFERENCES agents(id),
    FOREIGN KEY (assigneeId) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL,
    agentId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    message TEXT NOT NULL,
    reputation REAL DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (agentId) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL,
    agentId TEXT NOT NULL,
    service TEXT NOT NULL,
    amount TEXT NOT NULL,
    kiteTxHash TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    chain TEXT,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (agentId) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    agentId TEXT NOT NULL,
    agentName TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    jobId TEXT,
    txHash TEXT,
    kiteTxHash TEXT,
    hcsSequenceNumber INTEGER,
    chain TEXT
  );
`);

// Migrate existing tables: add columns if missing
try { db.exec('ALTER TABLE expenses ADD COLUMN chain TEXT'); } catch {}
try { db.exec('ALTER TABLE events ADD COLUMN chain TEXT'); } catch {}
try { db.exec('ALTER TABLE agents ADD COLUMN baseWalletAddress TEXT'); } catch {}

// ─── Agent CRUD ───────────────────────────────────────────────────────────────

const insertAgent = db.prepare(`
  INSERT INTO agents (id, name, role, skills, hederaAccountId, identityNftSerial, tokenBalance, stakedTokens, reputationScore, completedJobs, kiteAgentPassportId, kiteUsdcBalance, baseWalletAddress, status, registeredAt)
  VALUES (@id, @name, @role, @skills, @hederaAccountId, @identityNftSerial, @tokenBalance, @stakedTokens, @reputationScore, @completedJobs, @kiteAgentPassportId, @kiteUsdcBalance, @baseWalletAddress, @status, @registeredAt)
`);

const getAgent = db.prepare('SELECT * FROM agents WHERE id = ?');
const getAllAgents = db.prepare('SELECT * FROM agents');
const updateAgentStatus = db.prepare('UPDATE agents SET status = ? WHERE id = ?');
const updateAgentBalance = db.prepare('UPDATE agents SET tokenBalance = ? WHERE id = ?');
const updateAgentReputation = db.prepare('UPDATE agents SET reputationScore = ? WHERE id = ?');
const incrementCompletedJobs = db.prepare('UPDATE agents SET completedJobs = completedJobs + 1 WHERE id = ?');
const updateAgentNftSerial = db.prepare('UPDATE agents SET identityNftSerial = ? WHERE id = ?');
const updateAgentBaseWallet = db.prepare('UPDATE agents SET baseWalletAddress = ? WHERE id = ?');

function parseAgent(row: any): Agent | null {
  if (!row) return null;
  return {
    ...row,
    skills: JSON.parse(row.skills),
  };
}

export const agentDb = {
  create(agent: Agent): Agent {
    insertAgent.run({
      ...agent,
      skills: JSON.stringify(agent.skills),
      kiteAgentPassportId: agent.kiteAgentPassportId || null,
      kiteUsdcBalance: agent.kiteUsdcBalance || '0',
      baseWalletAddress: agent.baseWalletAddress || null,
    });
    return agent;
  },

  getById(id: string): Agent | null {
    return parseAgent(getAgent.get(id));
  },

  getAll(): Agent[] {
    return getAllAgents.all().map(parseAgent).filter(Boolean) as Agent[];
  },

  updateStatus(id: string, status: Agent['status']): void {
    updateAgentStatus.run(status, id);
  },

  updateBalance(id: string, balance: number): void {
    updateAgentBalance.run(balance, id);
  },

  updateReputation(id: string, score: number): void {
    updateAgentReputation.run(score, id);
  },

  incrementCompleted(id: string): void {
    incrementCompletedJobs.run(id);
  },

  updateNftSerial(id: string, serial: number): void {
    updateAgentNftSerial.run(serial, id);
  },

  updateBaseWallet(id: string, address: string): void {
    updateAgentBaseWallet.run(address, id);
  },
};

// ─── Job CRUD ─────────────────────────────────────────────────────────────────

const insertJob = db.prepare(`
  INSERT INTO jobs (id, title, description, requiredSkill, posterId, bounty, status, assigneeId, submissionUrl, totalExpenses, hcsSequenceNumber, txHash, createdAt, deadline)
  VALUES (@id, @title, @description, @requiredSkill, @posterId, @bounty, @status, @assigneeId, @submissionUrl, @totalExpenses, @hcsSequenceNumber, @txHash, @createdAt, @deadline)
`);

const getJob = db.prepare('SELECT * FROM jobs WHERE id = ?');
const getAllJobs = db.prepare('SELECT * FROM jobs');
const getJobsByStatus = db.prepare('SELECT * FROM jobs WHERE status = ?');
const getJobsBySkill = db.prepare('SELECT * FROM jobs WHERE requiredSkill = ? AND status = ?');
const updateJobStatus = db.prepare('UPDATE jobs SET status = ? WHERE id = ?');
const updateJobAssignee = db.prepare('UPDATE jobs SET assigneeId = ?, status = ? WHERE id = ?');
const updateJobSubmission = db.prepare('UPDATE jobs SET submissionUrl = ?, status = ? WHERE id = ?');
const updateJobTxHash = db.prepare('UPDATE jobs SET txHash = ? WHERE id = ?');
const updateJobHcs = db.prepare('UPDATE jobs SET hcsSequenceNumber = ? WHERE id = ?');
const updateJobExpenseTotal = db.prepare('UPDATE jobs SET totalExpenses = ? WHERE id = ?');

function parseJob(row: any): Job | null {
  if (!row) return null;
  const bids = bidDb.getByJobId(row.id);
  const expenses = expenseDb.getByJobId(row.id);
  return {
    ...row,
    bids,
    expenses,
    assigneeId: row.assigneeId || undefined,
    submissionUrl: row.submissionUrl || undefined,
    hcsSequenceNumber: row.hcsSequenceNumber || undefined,
    txHash: row.txHash || undefined,
  };
}

export const jobDb = {
  create(job: Omit<Job, 'bids' | 'expenses'>): Job {
    insertJob.run({
      ...job,
      assigneeId: job.assigneeId || null,
      submissionUrl: job.submissionUrl || null,
      hcsSequenceNumber: job.hcsSequenceNumber || null,
      txHash: job.txHash || null,
    });
    return { ...job, bids: [], expenses: [] };
  },

  getById(id: string): Job | null {
    return parseJob(getJob.get(id));
  },

  getAll(): Job[] {
    return getAllJobs.all().map(parseJob).filter(Boolean) as Job[];
  },

  getByStatus(status: string): Job[] {
    return getJobsByStatus.all(status).map(parseJob).filter(Boolean) as Job[];
  },

  getBySkillAndStatus(skill: string, status: string): Job[] {
    return getJobsBySkill.all(skill, status).map(parseJob).filter(Boolean) as Job[];
  },

  updateStatus(id: string, status: Job['status']): void {
    updateJobStatus.run(status, id);
  },

  assign(id: string, assigneeId: string): void {
    updateJobAssignee.run(assigneeId, 'assigned', id);
  },

  submit(id: string, submissionUrl: string): void {
    updateJobSubmission.run(submissionUrl, 'submitted', id);
  },

  setTxHash(id: string, txHash: string): void {
    updateJobTxHash.run(txHash, id);
  },

  setHcsSequenceNumber(id: string, seq: number): void {
    updateJobHcs.run(seq, id);
  },

  updateExpenseTotal(id: string, total: string): void {
    updateJobExpenseTotal.run(total, id);
  },
};

// ─── Bid CRUD ─────────────────────────────────────────────────────────────────

const insertBid = db.prepare(`
  INSERT INTO bids (jobId, agentId, amount, message, reputation, createdAt)
  VALUES (@jobId, @agentId, @amount, @message, @reputation, @createdAt)
`);

const getBidsByJob = db.prepare('SELECT * FROM bids WHERE jobId = ?');

export const bidDb = {
  create(jobId: string, bid: Bid): void {
    insertBid.run({ jobId, ...bid });
  },

  getByJobId(jobId: string): Bid[] {
    return getBidsByJob.all(jobId) as Bid[];
  },
};

// ─── Expense CRUD ─────────────────────────────────────────────────────────────

const insertExpense = db.prepare(`
  INSERT INTO expenses (jobId, agentId, service, amount, kiteTxHash, timestamp, chain)
  VALUES (@jobId, @agentId, @service, @amount, @kiteTxHash, @timestamp, @chain)
`);

const getExpensesByJob = db.prepare('SELECT * FROM expenses WHERE jobId = ?');
const getExpensesByAgent = db.prepare('SELECT * FROM expenses WHERE agentId = ?');

export const expenseDb = {
  create(jobId: string, expense: JobExpense): void {
    insertExpense.run({ jobId, ...expense, chain: expense.chain || null });
  },

  getByJobId(jobId: string): JobExpense[] {
    return getExpensesByJob.all(jobId) as JobExpense[];
  },

  getByAgentId(agentId: string): JobExpense[] {
    return getExpensesByAgent.all(agentId) as JobExpense[];
  },
};

// ─── Event CRUD ───────────────────────────────────────────────────────────────

const insertEvent = db.prepare(`
  INSERT INTO events (id, timestamp, agentId, agentName, action, detail, jobId, txHash, kiteTxHash, hcsSequenceNumber, chain)
  VALUES (@id, @timestamp, @agentId, @agentName, @action, @detail, @jobId, @txHash, @kiteTxHash, @hcsSequenceNumber, @chain)
`);

const getAllEvents = db.prepare('SELECT * FROM events ORDER BY timestamp DESC');
const getRecentEvents = db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?');

export const eventDb = {
  create(event: AgentEvent): void {
    insertEvent.run({
      ...event,
      jobId: event.jobId || null,
      txHash: event.txHash || null,
      kiteTxHash: event.kiteTxHash || null,
      hcsSequenceNumber: event.hcsSequenceNumber || null,
      chain: event.chain || null,
    });
  },

  getAll(): AgentEvent[] {
    return getAllEvents.all() as AgentEvent[];
  },

  getRecent(limit: number = 50): AgentEvent[] {
    return getRecentEvents.all(limit) as AgentEvent[];
  },
};

export default db;
