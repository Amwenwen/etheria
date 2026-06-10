# ⚔️ Warriors of Etheria

A browser-based **3v3 MOBA RPG** inspired by Mobile Legends, built with HTML5 Canvas, Firebase, and Cloudinary.

## Features

- **6 RPG Heroes** — Warrior, Mage, Assassin, Support, Tank, Marksman
- **3v3 Gameplay** — 3 lanes, jungle camps, towers, Nexus
- **4 Skills per hero** — Q / W / E / R (Ultimate)
- **Item Shop** — 12 purchasable items with stat bonuses
- **Leveling system** — Level 1–15 with stat growth
- **Online Multiplayer** — Real-time PvP via Firebase RTDB
- **Matchmaking** — Random match queue or invite by Player ID (`ETH#XXXX`)
- **Auth** — Google sign-in or Email/Password
- **Match History** — KDA, gold, win/loss saved to Firestore
- **Avatar Upload** — Powered by Cloudinary

## Tech Stack

| Layer | Tech |
|-------|------|
| Rendering | HTML5 Canvas |
| Auth | Firebase Authentication |
| Database | Firestore + Firebase RTDB |
| Storage | Cloudinary |
| Frontend | Vanilla JS (no bundler) |

## How to Play

| Action | Control |
|--------|---------|
| Move | Right-click map |
| Attack | Right-click enemy |
| Skills | Q / W / E / R |
| Shop | B |
| Camera | WASD / Arrow keys |
| Center camera | Space |
| Zoom | Mouse wheel |

## Setup

1. Clone the repo
2. Open `index.html` with a local server (e.g. VS Code Live Server)
3. Sign in with Google or create an account
4. Pick a hero → Play Solo vs AI or Find an Online Match

## Firebase Setup

Enable in [Firebase Console](https://console.firebase.google.com):
- Authentication (Google + Email/Password)
- Firestore Database
- Realtime Database

Paste rules from `firebase-rules.md` into both databases.

## Heroes

| Hero | Role | Playstyle |
|------|------|-----------|
| ⚔️ Theron | Warrior | Aggressive frontliner |
| 🔮 Lyria | Mage | Long-range burst damage |
| 🗡️ Kael | Assassin | Stealth & high burst |
| 💖 Sera | Support | Healer & reviver |
| 🛡️ Brutus | Tank | Absorbs damage, crowd control |
| 🏹 Reva | Marksman | Long-range sustained damage |

## License

MIT
