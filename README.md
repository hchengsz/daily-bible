# Daily Bible

Expo app for daily Bible reading, Scripture translation, speech playback, and catechism reading.

## Development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

Start Expo with the local proxy helper:

```bash
npm run start:proxy
```

Run checks:

```bash
npm run lint
npx tsc --noEmit
```

## Structure

- `app/` contains Expo Router routes and API routes.
- `src/features/reading/` contains the daily reading screen.
- `src/features/catechism/` contains the catechism reading screen.
- `src/data/bible/` contains Bible text and lookup helpers.
- `src/data/reading-plan/` contains the daily reading plan JSON files.
- `theme/` contains shared color tokens.
