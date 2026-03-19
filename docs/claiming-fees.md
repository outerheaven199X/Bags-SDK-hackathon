# How to Claim Your Fees

Every token launched on Bags.fm earns trading fees for the creator. This guide covers every way to check and collect what you're owed.

---

## Quick Start

```
You:    "Check if I have any fees to claim"
Agent:  shows your claimable positions with SOL amounts
You:    "Claim my BAGS fees"
Agent:  opens a signing page on localhost
You:    open the link → connect wallet → sign → SOL hits your wallet
```

That's it. One signature, instant payout.

---

## Step by Step

### 1. Check Your Claimable Positions

Ask your agent to show what's available:

```
"Show my claimable positions for 83xQKB...ofbiH"
"What fees can I claim?"
"Check my wallet"
```

The agent calls `bags_claimable_positions` and returns a list of tokens with the SOL amount owed for each.

### 2. Claim Fees for a Specific Token

Once you know which token has fees:

```
"Claim my fees from BAGS token"
"Claim fees for token mint ByF7NB...BAGS"
```

The agent calls `bags_claim_fees` with your wallet address and the token mint. This builds an unsigned claim transaction and opens a signing page at `http://localhost:3141/sign/<session-id>`.

### 3. Sign the Transaction

1. Open the signing link in your browser
2. Connect the **same wallet** you launched with (Phantom, Solflare, Backpack, or Coinbase)
3. Approve the transaction
4. SOL deposits to your wallet immediately

### 4. Claim All Fees at Once

If you have fees across multiple tokens:

```
"Claim all my fees"
```

The agent calls `bags_claim_all_fees` and batches every claimable position into one signing session. Open the link, connect, sign once, and collect everything.

---

## Useful Commands

| Say this | What happens |
|----------|-------------|
| "Show my claimable positions" | Lists every token with unclaimed fees and SOL amounts |
| "Claim my fees from $TOKEN" | Builds a claim transaction for one token |
| "Claim all my fees" | Batches all claimable positions into one signing session |
| "Show my lifetime fees" | Total fees earned across all tokens (claimed + unclaimed) |
| "Show claim events for my wallet" | History of past claims |

---

## How the Signing Page Works

The signing page runs locally on `http://localhost:3141`. No private keys leave your device.

1. The agent builds an unsigned transaction server-side
2. A session is created and persisted to disk (`.sessions/sessions.json`)
3. You open the localhost link in your browser
4. The page loads the transaction from the session
5. You connect your wallet and sign
6. The signed transaction is submitted to Solana

Sessions expire after 10 minutes. If a session expires, just ask the agent to re-run the claim.

---

## Troubleshooting

### "Session not found or expired"

The session has expired (10 minute TTL) or the server restarted. Ask the agent to re-run the claim — it will create a fresh session.

### Fees show 0 SOL

No trading activity has generated fees for that token yet. Fees accumulate as people trade the token on Bags.fm.

### Wrong wallet connected

You must connect the **same wallet** that is configured as the fee claimer for that token. This is usually the wallet that launched the token. Disconnect and reconnect with the correct wallet.

### Transaction fails after signing

This can happen if the on-chain state changed between building the transaction and signing it (e.g., someone else claimed first). Re-run the claim to get a fresh transaction.
