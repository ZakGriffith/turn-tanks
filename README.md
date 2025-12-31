# Turn Tanks

A turn-based tank battle game built with React and TypeScript.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and dev server
- **PixiJS 8** - WebGL-accelerated 2D graphics engine
- **GSAP** - High-performance animation library
- **ESLint** - Code linting

## Getting Started

### Installation

Dependencies are already installed, but if you need to reinstall them:

```bash
npm install
```

### Development

To start the development server:

```bash
npm run dev
```

This will start the Vite dev server, typically at `http://localhost:5173`

### Build

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

### Linting

To run ESLint:

```bash
npm run lint
```

## Deployment

### Deploy to Vercel

This project is ready to deploy to Vercel:

1. **Option 1: Deploy via Vercel CLI**

```bash
# Install Vercel CLI globally (if not already installed)
npm i -g vercel

# Deploy from the project directory
vercel
```

2. **Option 2: Deploy via Vercel Dashboard**

   - Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your repository
   - Vercel will automatically detect the Vite configuration
   - Click "Deploy"

3. **Option 3: Deploy via Git Integration**

```bash
# Push to your repository
git add .
git commit -m "Ready for deployment"
git push origin main

# Vercel will automatically deploy if connected to your repo
```

The `vercel.json` configuration is already set up to handle client-side routing for the single-page application.

## Project Structure

```
turn-tanks/
├── src/
│   ├── components/        # React components
│   │   ├── PixiGame.tsx   # PixiJS game container
│   │   ├── GameUI.tsx     # Game UI overlay (controls, status)
│   │   └── *.css          # Component styles
│   ├── game/              # Game engine and logic
│   │   ├── GameEngine.ts  # Core PixiJS game engine
│   │   ├── types.ts       # TypeScript type definitions
│   │   └── config.ts      # Game configuration constants
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # App entry point
│   └── index.css          # Global styles
├── index.html             # HTML entry point
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
├── vercel.json            # Vercel deployment config
└── .eslintrc.cjs          # ESLint configuration
```

## Game Features

- **Turn-based gameplay** - Players alternate turns with 2 actions each
- **Free movement** - Tanks move to any point within range, not grid-based
- **Action queuing** - Queue up to 2 actions (move/shoot) before executing
- **Collision detection** - Tanks and projectiles interact with obstacles and each other
- **Visual effects** - Dust trails, explosions, muzzle flash, smoke, and fire
- **Range indicators** - Visual feedback for movement range and blocked zones
- **Animated combat** - Tanks rotate, aim, move, and fire with smooth animations
- **Configurable settings** - Easily adjust game parameters in `config.ts`
