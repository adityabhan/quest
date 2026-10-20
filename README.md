# Sammy the Adventurer — Mission 1 POC

A mobile-first browser proof of concept for Sammy's first memory: getting ready, travelling to Masaldani, sharing yellow corn lentil soup, finding The First Spark, and receiving the clue to the Bird Sanctuary.

## Run locally

```powershell
npm install
npm run dev
```

Open the local address Vite prints. Build a static production version with:

```powershell
npm run build
```

The generated `dist` directory is ready for static hosting. Progress is saved in the browser under a versioned local-storage key; use **Start over** from the title card to clear it.

## Controls

- Phone: touch the left/right controls, then tap **Interact** near a glowing object.
- Desktop: use **A/D** or arrow keys to move; use **E**, Enter, or Up to interact.
- **Journal** shows the recovered artifact and memory after collection.
