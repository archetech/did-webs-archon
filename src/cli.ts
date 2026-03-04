#!/usr/bin/env node
/**
 * did-webs-archon CLI
 * Generate and serve did:webs files using Archon Protocol
 */

import { generateWebsFiles, extractAid } from './generator.js';
import { createServer } from './server.js';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`
did-webs-archon - did:webs driver for Archon Protocol

Usage:
  did-webs-archon generate <did:cid> --host <host> [options]
  did-webs-archon serve [options]
  did-webs-archon resolve <did:webs>

Commands:
  generate    Generate did.json and archon.cesr files
  serve       Start HTTP server to serve did:webs files
  resolve     Resolve a did:webs identifier

Generate Options:
  --host <host>       Host for did:webs (required)
  --path <path>       Optional path component
  --output <dir>      Output directory (default: ./webs-files)
  --gatekeeper <url>  Gatekeeper URL (default: https://archon.technology)

Serve Options:
  --port <port>       Server port (default: 7676)
  --dir <dir>         Directory with webs files (default: ./webs-files)
  --gatekeeper <url>  Gatekeeper URL for dynamic generation

Examples:
  did-webs-archon generate did:cid:bagaaiera... --host archon.social
  did-webs-archon serve --port 7676
  did-webs-archon resolve did:webs:archon.social:bagaaiera...
`);
}

function getArg(flag: string, defaultValue?: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

async function generate() {
  const didCid = args[1];
  const host = getArg('--host');
  const pathArg = getArg('--path') || null;
  const output = getArg('--output', './webs-files');
  const gatekeeper = getArg('--gatekeeper', 'https://archon.technology');

  if (!didCid || !host) {
    console.error('Error: did:cid and --host are required');
    printUsage();
    process.exit(1);
  }

  if (!didCid.startsWith('did:cid:')) {
    console.error('Error: Invalid did:cid format');
    process.exit(1);
  }

  console.log(`Generating did:webs files...`);
  console.log(`  DID: ${didCid}`);
  console.log(`  Host: ${host}`);
  console.log(`  Gatekeeper: ${gatekeeper}`);

  try {
    const files = await generateWebsFiles(didCid, host, pathArg, {
      gatekeeperUrl: gatekeeper,
      witnesses: [gatekeeper]
    });

    const aid = extractAid(didCid);
    const outDir = path.join(output!, aid);

    // Create output directory
    fs.mkdirSync(outDir, { recursive: true });

    // Write files
    const didJsonPath = path.join(outDir, 'did.json');
    const cesrPath = path.join(outDir, 'archon.cesr');

    fs.writeFileSync(didJsonPath, JSON.stringify(files.didJson, null, 2));
    fs.writeFileSync(cesrPath, files.archonCesr);

    console.log(`\nGenerated did:webs: ${files.did}`);
    console.log(`\nFiles written:`);
    console.log(`  ${didJsonPath}`);
    console.log(`  ${cesrPath}`);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function serve() {
  const port = parseInt(getArg('--port', '7676')!, 10);
  const dir = getArg('--dir', './webs-files');
  const gatekeeper = getArg('--gatekeeper', 'https://archon.technology');

  console.log(`Starting did:webs server...`);
  console.log(`  Port: ${port}`);
  console.log(`  Directory: ${dir}`);
  console.log(`  Gatekeeper: ${gatekeeper}`);

  const app = createServer({
    gatekeeperUrl: gatekeeper,
    staticDir: dir
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`\ndid-webs-archon server running at http://0.0.0.0:${port}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET /<aid>/did.json     - DID document`);
    console.log(`  GET /<aid>/archon.cesr  - Event stream`);
    console.log(`  GET /health             - Health check`);
  });
}

async function resolve() {
  const did = args[1];

  if (!did || !did.startsWith('did:webs:')) {
    console.error('Error: Valid did:webs identifier required');
    process.exit(1);
  }

  const gatekeeper = getArg('--gatekeeper', 'https://archon.technology');

  console.log(`Resolving: ${did}`);

  try {
    // Parse did:webs
    const parts = did.slice(9).split(':');
    const aid = parts[parts.length - 1];
    const host = parts[0].replace(/%3a/gi, ':');
    const didCid = `did:cid:${aid}`;

    const files = await generateWebsFiles(didCid, host, null, {
      gatekeeperUrl: gatekeeper
    });

    console.log(`\n=== DID Document ===`);
    console.log(JSON.stringify(files.didJson, null, 2));

    console.log(`\n=== Resolution Metadata ===`);
    console.log(JSON.stringify({
      contentType: 'application/did+json',
      equivalentId: [didCid],
      canonicalId: didCid
    }, null, 2));

  } catch (error) {
    console.error('Resolution failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Main
switch (command) {
  case 'generate':
    generate();
    break;
  case 'serve':
    serve();
    break;
  case 'resolve':
    resolve();
    break;
  case '--help':
  case '-h':
  case undefined:
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
