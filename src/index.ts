/**
 * did-webs-archon
 * 
 * did:webs driver using Archon Protocol as witness infrastructure
 * 
 * @example
 * ```typescript
 * import { generateWebsFiles, createServer } from '@archon-protocol/did-webs';
 * 
 * // Generate files
 * const files = await generateWebsFiles(
 *   'did:cid:bagaaiera...',
 *   'archon.social'
 * );
 * 
 * // Or run a server
 * const app = createServer();
 * app.listen(7676);
 * ```
 */

export {
  generateWebsFiles,
  extractAid,
  constructWebsDid,
  getWebsPaths,
  type ArchonEvent,
  type WebsFiles
} from './generator.js';

export {
  createServer,
  type ServerOptions
} from './server.js';
