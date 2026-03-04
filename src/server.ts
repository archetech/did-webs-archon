/**
 * did:webs HTTP Server
 * Serves did.json and archon.cesr files for Archon DIDs
 */

import express, { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { generateWebsFiles, extractAid } from './generator.js';

export interface ServerOptions {
  gatekeeperUrl?: string;
  staticDir?: string;
  cacheSeconds?: number;
}

// In-memory cache
const cache = new Map<string, { didJson: any; archonCesr: string; timestamp: number }>();

export function createServer(options: ServerOptions = {}): Express {
  const {
    gatekeeperUrl = 'https://archon.technology',
    staticDir,
    cacheSeconds = 300
  } = options;

  const cacheTtl = cacheSeconds * 1000;
  const app = express();

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'did-webs-archon',
      version: '0.1.0'
    });
  });

  // Serve did.json
  app.get('/:aid/did.json', async (req: Request, res: Response) => {
    const aid = req.params.aid;

    // Try static file first
    if (staticDir) {
      const staticPath = path.join(staticDir, aid, 'did.json');
      if (fs.existsSync(staticPath)) {
        res.setHeader('Content-Type', 'application/did+json');
        res.setHeader('X-Source', 'static');
        return res.sendFile(path.resolve(staticPath));
      }
    }

    // Check cache
    const cached = cache.get(aid);
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      res.setHeader('Content-Type', 'application/did+json');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.didJson);
    }

    // Generate dynamically
    try {
      const didCid = `did:cid:${aid}`;
      const host = req.get('host') || 'localhost';

      const files = await generateWebsFiles(didCid, host, null, {
        gatekeeperUrl,
        witnesses: [gatekeeperUrl]
      });

      cache.set(aid, {
        didJson: files.didJson,
        archonCesr: files.archonCesr,
        timestamp: Date.now()
      });

      res.setHeader('Content-Type', 'application/did+json');
      res.setHeader('X-Cache', 'MISS');
      res.json(files.didJson);

    } catch (error) {
      console.error('Error generating did.json:', error);
      res.status(404).json({
        error: 'DID not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Serve archon.cesr
  app.get('/:aid/archon.cesr', async (req: Request, res: Response) => {
    const aid = req.params.aid;

    // Try static file first
    if (staticDir) {
      const staticPath = path.join(staticDir, aid, 'archon.cesr');
      if (fs.existsSync(staticPath)) {
        res.setHeader('Content-Type', 'application/cesr');
        res.setHeader('X-Source', 'static');
        return res.sendFile(path.resolve(staticPath));
      }
    }

    // Check cache
    const cached = cache.get(aid);
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      res.setHeader('Content-Type', 'application/cesr');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached.archonCesr);
    }

    // Generate dynamically
    try {
      const didCid = `did:cid:${aid}`;
      const host = req.get('host') || 'localhost';

      const files = await generateWebsFiles(didCid, host, null, {
        gatekeeperUrl,
        witnesses: [gatekeeperUrl]
      });

      cache.set(aid, {
        didJson: files.didJson,
        archonCesr: files.archonCesr,
        timestamp: Date.now()
      });

      res.setHeader('Content-Type', 'application/cesr');
      res.setHeader('X-Cache', 'MISS');
      res.send(files.archonCesr);

    } catch (error) {
      console.error('Error generating archon.cesr:', error);
      res.status(404).json({
        error: 'DID not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Alias keri.cesr -> archon.cesr for compatibility
  app.get('/:aid/keri.cesr', (req: Request, res: Response) => {
    res.redirect(301, `/${req.params.aid}/archon.cesr`);
  });

  // Resolution endpoint
  app.get('/resolve/:did(*)', async (req: Request, res: Response) => {
    try {
      const did = req.params.did;

      if (!did.startsWith('did:webs:')) {
        return res.status(400).json({ error: 'Invalid did:webs format' });
      }

      const parts = did.slice(9).split(':');
      const aid = parts[parts.length - 1];
      const host = parts[0].replace(/%3a/gi, ':');
      const didCid = `did:cid:${aid}`;

      const files = await generateWebsFiles(didCid, host, null, {
        gatekeeperUrl,
        witnesses: [gatekeeperUrl]
      });

      res.json({
        didDocument: files.didJson,
        didResolutionMetadata: {
          contentType: 'application/did+json',
          retrieved: new Date().toISOString()
        },
        didDocumentMetadata: {
          equivalentId: [didCid],
          canonicalId: didCid
        }
      });

    } catch (error) {
      res.status(404).json({
        didDocument: null,
        didResolutionMetadata: {
          error: 'notFound',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  return app;
}

// Run as standalone server if executed directly
const isMain = process.argv[1]?.endsWith('server.js');
if (isMain) {
  const port = parseInt(process.env.PORT || '7676', 10);
  const app = createServer();
  app.listen(port, () => {
    console.log(`did-webs-archon server running at http://0.0.0.0:${port}`);
  });
}
