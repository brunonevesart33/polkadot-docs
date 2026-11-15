---
title: Terminal
description: Overview of the Product SDK terminal package — QR-code login, allowances, and transaction signing for command-line tools paired with the Polkadot App.
categories: Apps
---

# Terminal

## Introduction

[`@parity/product-sdk-terminal`](https://paritytech.github.io/product-sdk/api/terminal/) brings the Polkadot App pairing flow to command-line tools. It prints a QR code, waits for the user to scan it with their phone, and hands back a transaction creator that routes every signature to that phone, exactly as a Host does for a Product in a browser.

This is the package the [`playground` CLI](/apps/quick-start/) is built on.

!!! note "Not for Products"
    A Polkadot Product runs inside a Host, which already owns the pairing and the signing route, so a Product uses [Signer](/apps/product-sdk/signer/) instead. Reach for this package when you are writing a Node CLI _alongside_ your Product — a deploy script, a migration tool, a CI job that has to sign as you.

!!! note "Version"
    This page covers release 0.14 and later. Release 0.14.0 moved pairing, sessions, allowances, and signing into the truapi core and replaced most of the earlier API. If you are upgrading from 0.13, see the [0.14.0 changelog entry](https://github.com/paritytech/product-sdk/blob/main/product-sdk/packages/terminal/CHANGELOG.md).

## When to Use It

- To pair a Node CLI with the Polkadot App over a QR code and sign transactions as the paired account (`createTerminalAdapter`, `login`, `createSessionSigner`).
- To store data on the Bulletin Chain or publish to the Statement Store from a CLI, through allowances the phone grants (`requestResourceAllocation`, `submitPreimage`, `getStatementStoreProver`, `submitStatement`).
- Not inside a Product, and not in a browser: this package assumes Node, a filesystem for its session store, and a terminal to draw in.

## Core Concepts

- **`createTerminalAdapter(options)`**: The entry point. It is async, so `await` it. `appId` is the product identity and must be a dotNS name ending in `.dot`, `.paseo`, or `.testnet` (for example, `my-cli.dot`), or `localhost`. The core refuses any other value. `network` defaults to `paseo-next-v2`, the only preset in `TerminalNetworks`, and `storageDir` overrides the app's own directory (`~/.polkadot-apps/<appId>/` by default). `await adapter.destroy()` when finished.
- **`login()` restores or pairs**: `adapter.login({ reason, onPairing })` resolves with the stored session when there is one. Otherwise, it calls `onPairing` with a `polkadotapp://pair?…` deep link to render as a QR code, and resolves once the phone approves. Read the current session from `adapter.session` and follow changes with `adapter.onAuthStateChange`.
- **Two signer entry points**: `createSessionSigner(adapter)` returns a PAPI transaction creator for the adapter's `appId`, account `0`, which is what nearly every CLI wants. `createSessionSignerForAccount(adapter, { productId, derivationIndex })` covers a non-default sub-account or a different product.
- **Allowance keys stay in the core**: `requestResourceAllocation(adapter, resources)` asks the wallet for Statement Store, Bulletin, smart contract, or auto-signing allowances. The core keeps the allowance keys and uses them itself in `submitPreimage`, `getStatementStoreProver`, and `submitStatement`. No signer for the allowance account is exposed.
- **Approvals**: The core asks before it shares the product account, submits to a chain, or signs raw bytes. By default, `approveAll` approves each prompt. Pass your own `approvals` callback to `createTerminalAdapter` to ask the user instead.

## Pair a CLI and Sign

Install the package:

```bash
npm install @parity/product-sdk-terminal@{{ dependencies.javascript_packages.product_sdk_terminal.version }}
```

Create the adapter, log in (printing the QR code if the CLI is not paired yet), then build a signer:

```typescript
import {
  createTerminalAdapter,
  createSessionSigner,
  renderQrCode,
} from '@parity/product-sdk-terminal';

const adapter = await createTerminalAdapter({ appId: 'my-cli.dot' });

try {
  // Restores a stored session, or pairs first: print the QR and wait for the phone.
  const session = await adapter.login({
    reason: 'Sign in to my-cli',
    onPairing: async (deeplink) => {
      console.log(await renderQrCode(deeplink));
      console.log('Scan with the Polkadot App…');
    },
  });
  console.log('Logged in, identity:', session.identityAccountId ?? 'none');

  // A transaction creator for the product account my-cli.dot/0.
  const signer = await createSessionSigner(adapter);
  // Pass `signer` to a PAPI transaction's create(), createAndSubmit(), or createSubmitAndWatch().
} finally {
  await adapter.destroy(); // async, and required — otherwise the CLI never exits
}
```

## Store Data with an Allowance

For Bulletin or Statement Store writes, request the allowance from the wallet, then let the core use it. With a logged-in `adapter` from the previous section:

```typescript
import {
  requestResourceAllocation,
  submitPreimage,
} from '@parity/product-sdk-terminal';

// The wallet prompts the user. A refusal is an outcome, not an error.
const [outcome] = await requestResourceAllocation(adapter, [
  { tag: 'BulletinAllowance' },
]);

if (outcome === 'Allocated') {
  // The core signs with the allowance key, which never leaves it.
  const key = await submitPreimage(adapter, new TextEncoder().encode('hello'));
  console.log('Stored on Bulletin, preimage key:', key);
} else {
  // 'Rejected' (declined on the phone) or 'NotAvailable'
  console.error('Bulletin allowance not granted:', outcome);
}
```

`requestResourceAllocation` returns one outcome per requested resource, in order: `Allocated`, `Rejected`, or `NotAvailable`. Transport failures throw. Requesting an allowance the product already holds increases it rather than replacing it.

## Limitations

- **Requires Node 22 or later.** The package uses the global `WebSocket` and `node:worker_threads`.
- Node only. There is no browser build, and sessions are stored on disk. Do not bundle the package into a single file: the core's worker and WASM files load from beside it.
- `adapter.destroy()` is not optional: the core's thread keeps the process alive until it is stopped. It is async, so `await` it, and call it from a `finally` block so a failed pairing still tears down. It lets open operations finish, for up to 30 seconds, before it closes the chain connections.
- Pairing takes 80 to 110 seconds on Paseo. The default per-call timeout, `requestTimeoutMs`, is 300 seconds.
- When signing fails because the session's Statement Store or Bulletin allowance has lapsed, the signer throws `AllowanceExpiredError`, whose `resource` field names the allowance. Other refusals throw a plain `Error`.
- Sessions created by releases before 0.14 are not read, so users pair once more after upgrading.

## Where to Go Next

<div class="grid cards" markdown>

-   <span class="badge learn">Learn</span> **Auth**

    ---

    The runtime-agnostic core beneath this package, if you want the sign-in flow without the terminal rendering.

    [:octicons-arrow-right-24: Auth](/apps/product-sdk/auth/)

-   <span class="badge learn">Learn</span> **Signer**

    ---

    The equivalent for a Product running inside a Host, where pairing is already handled for you.

    [:octicons-arrow-right-24: Signer](/apps/product-sdk/signer/)

-   <span class="badge external">External</span> **API Reference**

    ---

    The complete `terminal` surface: the adapter, session signers, allowance helpers, networks, and approvals.

    [:octicons-arrow-right-24: Visit Site](https://paritytech.github.io/product-sdk/api/terminal/)

</div>
