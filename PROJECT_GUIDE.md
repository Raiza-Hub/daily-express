# Project Guide

This guide provides instructions on how to start the Daily Express project and lists all navigable links for each application within the monorepo.

## Getting Started

The project is a monorepo managed with [Turborepo](https://turbo.build/) and uses [Bun](https://bun.sh/) as its package manager.

### Prerequisites

- [Node.js](https://nodejs.org/) (>=18, as specified in `package.json`)
- [Bun](https://bun.sh/) (`bun@1.3.6`)

### Installation

To install all dependencies for the shared packages and the apps, run the following command from the root of the project:

```bash
bun install
```

### Running the Development Server

You can start the development servers for all applications simultaneously using Turborepo from the root directory:

```bash
bun run dev
```

This will spin up the development servers for the different apps on the following ports:
- **web app**: `http://localhost:3000`
- **docs app**: `http://localhost:3001`
- **drivers app**: `http://localhost:3002`

If you want to run a specific app in development mode, you can either filter it via Turborepo or navigate to the app's directory:

```bash
# Using Turborepo filter from root
bun run dev --filter=docs

# Or navigating to the app directory
cd apps/docs
bun run dev
```

## Navigable Links

Here is the directory of all the navigable pages (routes) available in each application.

### Web App (`apps/web`) 
*Running on port 3000*

**Main Routes:**
- `/` - Home Page
- `/trip-status` - Trip Status Page

**Auth Routes:**
- `/sign-in` - Sign In
- `/sign-up` - Sign Up
- `/verify-email` - Verify Email
- `/forget-password` - Forget Password
- `/reset-password` - Reset Password

**Settings Routes:**
- `/settings/profile` - Profile Settings

---

### Drivers App (`apps/drivers`)
*Running on port 3002*

**Main Routes:**
- `/` - Home Page
- `/payouts` - Payouts System

**Auth Routes:**
- `/sign-up` - Sign Up

**Settings Routes:**
- `/settings/accounts` - Accounts Settings
- `/settings/bank-details` - Bank Details Settings
- `/settings/profile` - Profile Settings

---

### Docs App (`apps/docs`)
*Running on port 3001*

**Main Routes:**
- `/` - Home Page
