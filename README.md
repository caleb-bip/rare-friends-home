# HOME

Walk one Rare Friend home across a night street. The selected Generations NFT is the walker. Its original 16×16 pixels are drawn, not redrawn. Every night spends 1 RF.

FriendSDK v0.1.2. Purchases, finds, and redemptions are simulated.

## Play in the browser

No wallet: [https://plaza-mist-arch-summit.grok.me](https://plaza-mist-arch-summit.grok.me)

That page walks public Friend #1 with a simulated ledger that starts at 20 RF. It is the rehearsal, not the ownership check.

## Run the FriendSDK build

The component is `games/home`.

```sh
npm install @rarefriends/friendsdk@0.1.2
npx friendsdk dev ./games/home
npx friendsdk check ./games/home
npx friendsdk build ./games/home
```

`friendsdk dev` needs a browser wallet on Robinhood mainnet that holds a hardwired Generations NFT, generation 1 or higher. The SDK runtime checks ownership. This game does not.

Rules, odds, and controls are in [games/home/README.md](games/home/README.md).
