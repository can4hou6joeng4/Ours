# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- **Build for WeChat**: `npm run build:weapp`
- **Development (Watch mode)**: `npm run dev:weapp`
- **Project Config**: WeChat specific configurations are in `project.config.json`.

### Cloud Functions
- Cloud functions are located in `/cloudfunctions`.
- Each function (e.g., `addTask`, `getTasks`) is a standalone Node.js package.
- To deploy or test, use the WeChat DevTools or relevant CLI.

## Code Architecture

### Project Structure
- **Frontend (Taro + React)**: Located in `/src`.
  - `/src/pages`: Contains page components and their respective configurations.
  - `/src/app.config.ts`: Main entry point for routing and global configuration.
  - `/src/styles`: Global SCSS styles.
- **Backend (Cloud Functions)**: Located in `/cloudfunctions`.
  - Uses `wx-server-sdk` for interacting with WeChat services (database, auth).
- **Configuration**:
  - `/config`: Taro-specific build configs for different environments.

### Coding Patterns
- **Framework**: React functional components with Hooks.
- **Type Safety**: TypeScript is used throughout both frontend and backend.
- **Styling**: SCSS for component-level and global styling.
- **Cloud Integration**: Interaction with cloud functions is typically handled via `taro.cloud.callFunction`.
