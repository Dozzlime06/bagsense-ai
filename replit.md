# BagSense AI - Smart Trading Assistant

## Overview

BagSense AI is an AI-powered trading assistant for bags.fm, a Solana-based memecoin launchpad. The application provides a chat interface where users can get real-time token analysis with live data from bags.fm API and DexScreener. The AI has a street-smart trader personality and provides honest analysis without overpromising.

## Features

### Real-Time Token Analysis
When users paste a token address, BagSense fetches:
- **From DexScreener**: Token name, symbol, price, market cap, liquidity, 24h volume
- **From bags.fm API**: Creator info (username, social platform), wallet address, royalty %, fee splits, lifetime fees

### AI Capabilities
- Analyzes token data and identifies red/yellow flags
- Identifies token narrative (AI, animals, politics, memes) and whether it's "in meta"
- Honest about limitations - won't claim to check data it can't access
- Casual trader personality with slang ("aping in", "NFA", "DYOR")

### What BagSense CANNOT Do (transparent limitations)
- Cannot browse trending tokens (user must paste address)
- Cannot see creator's past launches or history
- Cannot see top holders or whale wallets
- Cannot verify social accounts are real vs botted

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark mode default)
- **Build Tool**: Vite with React plugin

The frontend is a single-page application with a chat interface as the main view. It uses streaming responses for real-time AI message display.

### Backend Architecture
- **Framework**: Express 5 on Node.js
- **Language**: TypeScript with ESM modules
- **API Style**: REST endpoints with streaming support for chat
- **AI Integration**: OpenAI-compatible API via Replit AI Integrations

The server handles chat requests by streaming responses from the AI model. It includes a comprehensive system prompt that gives the AI knowledge about bags.fm trading concepts.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Generated via `drizzle-kit push`
- **Current Entities**: Users, Conversations, Messages

The schema supports chat persistence with conversation history. An in-memory storage fallback exists for development.

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds frontend to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Build Script**: Custom TypeScript build script at `script/build.ts`

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components including chat interface
    pages/        # Route components
    lib/          # Utilities and query client
server/           # Express backend
  chat.ts         # AI chat endpoint with system prompt
  routes.ts       # API route registration
  storage.ts      # Data access layer
shared/           # Shared code between client/server
  schema.ts       # Drizzle database schema
```

## External Dependencies

### AI Services
- **OpenAI API**: Used via Replit AI Integrations for chat completions
- **Environment Variables**: 
  - `AI_INTEGRATIONS_OPENAI_API_KEY` - API key for AI service
  - `AI_INTEGRATIONS_OPENAI_BASE_URL` - Base URL for AI service endpoint

### External APIs
- **bags.fm API**: Creator info, royalty data, lifetime fees
  - Base URL: `https://public-api-v2.bags.fm/api/v1/`
  - Requires `BAGS_API_KEY` secret
  - Endpoints: `/token-launch/creator/v3`, `/token-launch/lifetime-fees`
- **DexScreener API**: Token metadata, price, market cap, liquidity
  - Base URL: `https://api.dexscreener.com/tokens/v1/solana/`
  - No API key required (free)

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage for Express (available but may not be active)

### Replit Integrations
The project includes pre-built integration modules in `server/replit_integrations/` and `client/replit_integrations/`:
- **Audio**: Voice chat with speech-to-text and text-to-speech
- **Chat**: Conversation storage and management
- **Image**: Image generation capabilities
- **Batch**: Rate-limited batch processing utilities

These integrations provide ready-to-use functionality that can be enabled as needed.