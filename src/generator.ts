/**
 * did:webs Generator for Archon Protocol
 * Generates did.json and archon.cesr files from did:cid identifiers
 */

export interface ArchonEvent {
  v: string;           // Version
  t: string;           // Event type: icp, upd, rot, anc
  d: string;           // Event digest (CID)
  i: string;           // Identifier
  s: string;           // Sequence number
  p?: string;          // Previous event CID
  kt?: string;         // Key threshold
  k?: any[];           // Current keys (JWK)
  nt?: string;         // Next key threshold
  n?: string[];        // Next key commitment
  bt?: string;         // Witness threshold
  b?: string[];        // Witnesses (gatekeeper URLs)
  r?: string;          // Registry
  c?: string[];        // Configuration
  a?: any[];           // Anchors
  dt: string;          // Datetime
  anchor?: {           // For anchor events
    chain: string;
    blockHeight: number;
    blockHash: string;
    txid: string;
    txidx?: number;
    batchid?: string;
    timestamp: string;
  };
}

export interface WebsFiles {
  didJson: any;
  archonCesr: string;
  did: string;
}

const ARCHON_VERSION = 'ARCHON10JSON000001_';
const DEFAULT_GATEKEEPER = process.env.ARCHON_GATEKEEPER_URL || 'https://archon.technology';

/**
 * Extract the AID (bare identifier) from a did:cid
 */
export function extractAid(didCid: string): string {
  if (didCid.startsWith('did:cid:')) {
    return didCid.slice(8);
  }
  return didCid;
}

/**
 * Construct a did:webs identifier
 */
export function constructWebsDid(host: string, path: string | null, aid: string): string {
  // Encode port colons as %3a per spec
  const encodedHost = host.replace(/:/g, '%3a');
  if (path) {
    return `did:webs:${encodedHost}:${path}:${aid}`;
  }
  return `did:webs:${encodedHost}:${aid}`;
}

/**
 * Fetch DID document and metadata from gatekeeper
 */
async function fetchDidData(didCid: string, gatekeeperUrl: string = DEFAULT_GATEKEEPER): Promise<any> {
  const url = `${gatekeeperUrl}/api/v1/did/${didCid}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch DID: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Generate inception event from DID data
 */
function generateInceptionEvent(
  aid: string,
  didDoc: any,
  metadata: any,
  witnesses: string[]
): ArchonEvent {
  // Extract keys from verification methods
  const keys = didDoc.verificationMethod?.map((vm: any) => vm.publicKeyJwk) || [];
  
  return {
    v: ARCHON_VERSION,
    t: 'icp',
    d: aid,
    i: aid,
    s: '0',
    kt: '1',
    k: keys,
    nt: '1',
    n: ['PRE_ROTATION_COMMITMENT'],  // Placeholder - would need actual next key hash
    bt: witnesses.length.toString(),
    b: witnesses,
    c: ['EO'],  // Establishment only
    r: metadata.didDocumentRegistration?.registry || 'hyperswarm',
    dt: metadata.created
  };
}

/**
 * Generate update event
 */
function generateUpdateEvent(
  aid: string,
  versionCid: string,
  prevCid: string,
  sequence: number,
  didDoc: any,
  metadata: any,
  anchors: any[] = []
): ArchonEvent {
  const keys = didDoc.verificationMethod?.map((vm: any) => vm.publicKeyJwk) || [];
  
  return {
    v: ARCHON_VERSION,
    t: 'upd',
    d: versionCid,
    i: aid,
    s: sequence.toString(),
    p: prevCid,
    kt: '1',
    k: keys,
    a: anchors,
    dt: metadata.updated || new Date().toISOString()
  };
}

/**
 * Generate anchor event for registry confirmation
 */
function generateAnchorEvent(
  aid: string,
  eventCid: string,
  sequence: number,
  timestamp: any
): ArchonEvent {
  return {
    v: ARCHON_VERSION,
    t: 'anc',
    d: eventCid,
    i: aid,
    s: sequence.toString(),
    r: timestamp.chain,
    dt: timestamp.upperBound?.timeISO || new Date().toISOString(),
    anchor: {
      chain: timestamp.chain,
      blockHeight: timestamp.upperBound?.height,
      blockHash: timestamp.upperBound?.blockid,
      txid: timestamp.upperBound?.txid,
      txidx: timestamp.upperBound?.txidx,
      batchid: timestamp.upperBound?.batchid,
      timestamp: timestamp.upperBound?.timeISO
    }
  };
}

/**
 * Convert DID document to did:webs format
 */
function convertToWebsDidDoc(
  didDoc: any,
  websDid: string,
  didCid: string,
  name?: string
): any {
  const websDoc: any = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: websDid,
    verificationMethod: didDoc.verificationMethod?.map((vm: any) => ({
      ...vm,
      id: vm.id,
      controller: websDid
    })),
    authentication: didDoc.authentication,
    assertionMethod: didDoc.assertionMethod,
    alsoKnownAs: [
      didCid,
      `did:web:${websDid.split(':')[2]}:${extractAid(didCid)}`
    ]
  };

  // Add name as alsoKnownAs if provided
  if (name) {
    websDoc.alsoKnownAs.push(`https://archon.social/member/${name}`);
  }

  // Copy services if present
  if (didDoc.service) {
    websDoc.service = didDoc.service;
  }

  return websDoc;
}

/**
 * Serialize events to CESR format (newline-delimited JSON)
 */
function serializeEvents(events: ArchonEvent[]): string {
  const lines: string[] = [
    '# Archon CESR Event Stream',
    '# Format: ARCHON10JSON (Archon v1.0, JSON encoding)',
    '# Generated: ' + new Date().toISOString(),
    ''
  ];

  for (const event of events) {
    // Add comment for event type
    const typeNames: Record<string, string> = {
      'icp': 'Inception',
      'upd': 'Update',
      'rot': 'Rotation',
      'anc': 'Anchor'
    };
    lines.push(`# ${typeNames[event.t] || event.t} Event (s=${event.s})`);
    lines.push(JSON.stringify(event));
    
    // Add signature placeholder
    lines.push(JSON.stringify({ 
      signatures: [{ index: 0, signature: 'ECDSA_SECP256K1_SIGNATURE' }] 
    }));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate did:webs files from a did:cid
 */
export async function generateWebsFiles(
  didCid: string,
  host: string,
  path: string | null = null,
  options: {
    gatekeeperUrl?: string;
    witnesses?: string[];
    name?: string;
  } = {}
): Promise<WebsFiles> {
  const gatekeeperUrl = options.gatekeeperUrl || DEFAULT_GATEKEEPER;
  const witnesses = options.witnesses || [gatekeeperUrl];

  // Fetch DID data
  const didData = await fetchDidData(didCid, gatekeeperUrl);
  const didDoc = didData.didDocument;
  const metadata = didData.didDocumentMetadata;

  // Extract AID
  const aid = extractAid(didCid);

  // Construct did:webs identifier
  const websDid = constructWebsDid(host, path, aid);

  // Generate events
  const events: ArchonEvent[] = [];

  // 1. Inception event
  events.push(generateInceptionEvent(aid, didDoc, metadata, witnesses));

  // 2. If there are updates (version > 1), generate update events
  const currentVersion = parseInt(metadata.versionSequence || '1', 10);
  if (currentVersion > 1) {
    // We only have current state, so generate a single update event
    // representing the current state
    const anchors: any[] = [];
    
    // Add credentials from manifest as anchors
    const manifest = didData.didDocumentData?.manifest;
    if (manifest) {
      for (const credDid of Object.keys(manifest)) {
        anchors.push({ type: 'credential', did: credDid });
      }
    }

    events.push(generateUpdateEvent(
      aid,
      metadata.versionId,
      aid, // Previous is inception for simplified stream
      currentVersion,
      didDoc,
      metadata,
      anchors
    ));
  }

  // 3. If confirmed on chain, add anchor event
  if (metadata.confirmed && metadata.timestamp) {
    events.push(generateAnchorEvent(
      aid,
      metadata.versionId || aid,
      currentVersion,
      metadata.timestamp
    ));
  }

  // Generate did.json
  const didJson = convertToWebsDidDoc(didDoc, websDid, didCid, options.name);

  // Generate archon.cesr
  const archonCesr = serializeEvents(events);

  return {
    didJson,
    archonCesr,
    did: websDid
  };
}

/**
 * Generate did:webs URL paths for hosting
 */
export function getWebsPaths(aid: string): { didJson: string; archonCesr: string } {
  return {
    didJson: `/${aid}/did.json`,
    archonCesr: `/${aid}/archon.cesr`
  };
}
