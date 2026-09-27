# HOME

Get one Rare Friend across a night street. The selected Generations NFT is the walker. Its original 16×16 pixels are drawn, not redrawn. Every night spends 1 RF.

FriendSDK v0.1.2. Purchases, finds, and redemptions are simulated unless a live deployment is added later.

Hosted rehearsal, no wallet: https://plaza-mist-arch-summit.grok.me

## Play

1. Connect a wallet that holds a hardwired Generations NFT (generation 1 or higher) on Robinhood mainnet. The SDK runtime checks ownership. This game does not. The hosted rehearsal skips this and walks public Friend #1.
2. **Go out** spends 1 RF and pays for one crossing.
3. **Step** when the next lane shows a gold gap. A red gap means a car is there. Getting bumped does not spend another night.
4. Reach the stoop. The find comes from the weighted table. How cleanly you crossed does not change it.
5. **Keep it** leaves the fare spent. **Redeem** returns that find's fixed RF. A dark stoop cannot be redeemed. Kept finds do not expire.

Touch the street or the Step button. Keyboard: Space or Enter does the same when a button is not focused.

Sound starts off. Settings has mute and reduced motion. Reduced motion slows the cars and the step.

## Costs and rewards

Preview ledgers start at **20 RF**, matching the FriendSDK host. One night costs **1 RF** and reserves the maximum prize (**3 RF**) until it settles.

| On the stoop | Chance | Redeem |
| --- | ---: | ---: |
| Dark stoop | 45% | none |
| Loose coin | 28% | 0.2 RF |
| Lit window | 18% | 0.6 RF |
| House key | 7.5% | 1.2 RF |
| Night edition | 1.5% | 3 RF |

Expected redeem value is **0.299 RF** per night. Keeping a find spends the full 1 RF. A new night stops if the simulated block no longer has free stake to back the maximum prize. Redeem a kept find to continue.

## Run

From a project with this game directory and FriendSDK v0.1.2 installed:

```sh
npx friendsdk dev ./games/home
```

Open the printed URL. No RF funding or signature is required for the simulated preview. A browser wallet on Robinhood mainnet with an eligible Friend is required, including for the preview.

```sh
npx friendsdk check ./games/home
npx friendsdk build ./games/home
```

## Credits

Original Friend pixels are read from the Generations sprite registry through FriendSDK. No third-party illustration replaces them. Sound cues are the SDK sound kit. Cars are drawn in the game. They are not Friend artwork.
