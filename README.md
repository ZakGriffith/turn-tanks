# Turn Tanks

A turn-based tank battle game built with React and TypeScript.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and dev server
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

## Project Structure

```
turn-tanks/
├── src/
│   ├── App.tsx          # Main app component
│   ├── App.css          # App styles
│   ├── main.tsx         # App entry point
│   ├── index.css        # Global styles
│   └── vite-env.d.ts    # Vite type definitions
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── .eslintrc.cjs        # ESLint configuration
```

## Next Steps

- [ ] Design game mechanics (turn system, tank movement, shooting)
- [ ] Create game board component
- [ ] Implement tank components
- [ ] Add game state management
- [ ] Implement turn-based logic
- [ ] Add animations and visual effects
