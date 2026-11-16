import { DedotClient, SmoldotProvider } from 'dedot';
import type { PolkadotApi } from '@dedot/chaintypes';
import * as smoldot from 'smoldot';

// import `polkadot` chain spec to connect to Polkadot
import { polkadot } from '@substrate/connect-known-chains';

// Start smoldot instance & initialize a chain
const smoldotClient = smoldot.start();
const chain = await smoldotClient.addChain({ chainSpec: polkadot });

// Initialize providers & clients
const provider = new SmoldotProvider(chain);
const client = await DedotClient.new<PolkadotApi>(provider);
