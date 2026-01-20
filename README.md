# Dr. Jira Poker Planner 🃏

![Dr. Jira Poker Wizard](./assets/lunar_wizard.png)

Dr. Jira Poker Planner is a real-time Agile estimation tool built on **Atlassian Forge**. It allows teams to vote on Jira issues using story points (Fibonacci, T-Shirt sizes, or Custom decks) directly within the Jira issue view or a standalone lobby.

## ✨ Features

- **Real-Time Voting**: Updates instantly for all users (powered by Forge Storage + Polling).
- **Multiple Contexts**:
  - **Issue Panel**: Estimate a specific issue directly from the Jira Issue view.
  - **Lobby Mode**: Open a "Room" for a whole project and switch between issues dynamically.
- **Deck Customization**:
  - Fibonacci (0, 1, 2, 3, 5, 8, 13, 21, ?)
  - T-Shirt Sizes (XS, S, M, L, XL)
  - Custom Decks (Define your own values)
- **Moderator Controls**:
  - Start/Stop Timers (Synced for all users).
  - Reveal/Reset Votes.
  - Edit Issue Summary/Description in real-time.
- **Immersive UI**:
  - "Green Felt" poker table aesthetic.
  - Face-down card animations.
  - Responsive design.

## 🚀 Installation & Deployment

### Prerequisites

- Node.js (v18+)
- [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) installed globally: `npm install -g @forge/cli`
- An Atlassian Cloud site (Jira).

### Setup

1.  **Install Dependencies**:

    ```bash
    npm install
    cd static/poker-planner-ui
    npm install
    cd ../..
    ```

2.  **Login to Forge**:

    ```bash
    forge login
    ```

3.  **Deploy**:

    ```bash
    # Build the frontend first
    cd static/poker-planner-ui
    npm run build
    cd ../..

    # Deploy to Atlassian
    forge deploy
    ```

4.  **Install on Jira**:
    ```bash
    forge install
    ```
    Select your Development or Production environment and your Jira site.

## ⚙️ Configuration

The app includes an **Admin Page** for global settings.

1.  Navigate to **Apps** -> **Manage Apps** in Jira.
2.  Find **Dr. Jira Poker Planner** in the left sidebar.
3.  Configure:
    - **Default Deck**: Fibonacci, T-Shirt, or Custom.
    - **Permissions**: Who can reveal votes (Moderator, Assignee, or Any).
    - **Webhook Integration**: Send "Reveal" events to an N8N webhook for automation.

## 🧪 Testing

We support End-to-End (E2E) testing using **Playwright**.

See [TESTING.md](./TESTING.md) for detailed instructions on setting up and running tests.

## 🛠 Tech Stack

- **Platform**: Atlassian Forge (Custom UI)
- **Frontend**: React, Atlassian Design System (`@atlaskit`)
- **Backend**: Forge Resolvers (Node.js runtime)
- **Storage**: Forge Key-Value Storage
- **Routing**: `react-router` (in-app view switching)

## 📄 License

MIT
