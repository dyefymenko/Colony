import { Router, Request, Response } from 'express';
import { agentDb } from '../db';
import { config } from '../config';
import { generateNftSvg } from '../services/nftImage';

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /nft/agent/:agentId/image — SVG identity card */
router.get('/agent/:agentId/image', (req: Request, res: Response) => {
  const agent = agentDb.getById(req.params.agentId as string);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(generateNftSvg(agent));
});

/** GET /nft/agent/:agentId — HIP-412 metadata JSON */
router.get('/agent/:agentId', (req: Request, res: Response) => {
  const agent = agentDb.getById(req.params.agentId as string);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  res.json({
    name: `${agent.name} — Colony Agent`,
    description: `${agent.role} on the Colony autonomous agent marketplace. Skills: ${agent.skills.join(', ')}.`,
    image: `${config.serverUrl}/nft/agent/${agent.id}/image`,
    properties: {
      role: agent.role,
      skills: agent.skills,
      hedera_account: agent.hederaAccountId,
      reputation_score: agent.reputationScore,
      registered_at: agent.registeredAt,
    },
  });
});

export { router as nftRoutes };
