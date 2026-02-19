import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AgentEvent } from '../models/event';
import { eventDb } from '../db';

const router = Router();

// Connected SSE clients
const clients: Set<Response> = new Set();

// SSE endpoint
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send recent events as initial data
  const recent = eventDb.getRecent(20);
  for (const event of recent.reverse()) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  clients.add(res);
  console.log(`SSE client connected (total: ${clients.size})`);

  req.on('close', () => {
    clients.delete(res);
    console.log(`SSE client disconnected (total: ${clients.size})`);
  });
});

// Broadcast an event to all SSE clients and persist it
export function broadcastEvent(
  partial: Omit<AgentEvent, 'id' | 'timestamp'>
): AgentEvent {
  const event: AgentEvent = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    ...partial,
  };

  // Persist
  eventDb.create(event);

  // Broadcast to all SSE clients
  const data = JSON.stringify(event);
  for (const client of clients) {
    client.write(`data: ${data}\n\n`);
  }

  return event;
}

export { router as eventsRouter };
