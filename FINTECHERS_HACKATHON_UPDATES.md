# Fintechers Hackathon updates

## Background

AlphaGrid placed **2nd** in the Arbitrum Online Buildathon and **1st** at the Arbitrum IRL Buildathon in London, both in the Agentic category. That product was about onboarding: one prompt from signup to a live trade.

For Fintechers we added three things: strategy decisions on AWS Bedrock, live market data from Apify, and research on whether that data is useful for trading.

---

## Strategy decisions on AWS Bedrock

On Arbitrum Sepolia, strategy runs call **Amazon Nova Lite** (`eu.amazon.nova-lite-v1:0`) through AWS Bedrock.

Each run stores which model made the decision, and logs the input and the reply. You can see what the model was given and what it returned.

---

## Market data from Apify

Agents can use three feeds when they decide:

| Feed | What it is |
|------|------------|
| **Truth Social** | Posts from Truth Social |
| **Equity news** | News for the stocks the agent trades |
| **FRED** | Public US economic series — interest rates, inflation, and similar |

You can preview a feed before attaching it to an agent. The setup is documented under Market signals.

---

## Research

We checked whether public text actually moves prices. The write-ups are in [`research/`](research/).

**Does the public feed move markets?**  
Naming a company in a post is not enough. Fast trading systems already price that company. What worked was one step further: an event about company A that actually matters for a related company B. That link takes judgment, and it showed about **+1.5% over 3 days**.  
→ [feed-moves-markets.html](research/feed-moves-markets.html)

**Can filing text tell you how big an earnings move will be?**  
The text did not predict whether a stock would go up or down. It did predict how large the move would be, on filings the test had not seen before. We then checked whether that can be traded with options. After real trading costs, a lot of the profit disappears.  
→ [earnings-volatility.html](research/earnings-volatility.html)

The research is there so we know which inputs are worth using, and which only look useful.
