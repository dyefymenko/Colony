import { Router, Request, Response } from 'express';
import { agentDb } from '../db';
import { config } from '../config';
import { generateNftSvg } from '../services/nftImage';
import { uploadSvgToIpfs, uploadMetadataToIpfs } from '../services/pinata';

const router = Router();

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

/** GET /nft/debug/pinata — test Pinata connectivity, returns result or error */
router.get('/debug/pinata', async (_req: Request, res: Response) => {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return res.json({ error: 'PINATA_JWT not set' });

  try {
    const testSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10"/></svg>';
    const imageUri = await uploadSvgToIpfs(testSvg, 'debug-test');
    const metaUri = await uploadMetadataToIpfs({ test: true, image: imageUri }, 'debug-test');
    res.json({ ok: true, imageUri, metaUri });
  } catch (err: any) {
    res.json({ ok: false, error: err.message, stack: err.stack });
  }
});

export { router as nftRoutes };
