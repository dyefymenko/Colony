/**
 * Pinata IPFS upload service.
 * Requires PINATA_JWT environment variable.
 */

const PINATA_API = 'https://api.pinata.cloud';

function getJwt(): string {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT env var not set');
  return jwt;
}

/**
 * Upload an SVG string to Pinata and return an ipfs:// URI.
 */
export async function uploadSvgToIpfs(svg: string, name: string): Promise<string> {
  // Use File (not Blob) so Node 20's FormData sets the filename in Content-Disposition
  const file = new File([svg], `${name}.svg`, { type: 'image/svg+xml' });
  const form = new FormData();
  form.append('file', file);
  form.append('pinataMetadata', JSON.stringify({ name: `${name} — Colony NFT Image` }));
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getJwt()}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata SVG upload failed (${res.status}): ${text}`);
  }

  const data: any = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

/**
 * Upload a metadata JSON object to Pinata and return an ipfs:// URI.
 */
export async function uploadMetadataToIpfs(metadata: object, name: string): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getJwt()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataMetadata: { name: `${name} — Colony NFT Metadata` },
      pinataOptions: { cidVersion: 1 },
      pinataContent: metadata,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata metadata upload failed (${res.status}): ${text}`);
  }

  const data: any = await res.json();
  return `ipfs://${data.IpfsHash}`;
}
