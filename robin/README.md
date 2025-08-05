# Agent Robin - Slack App

A Slack app built with Node.js and the Slack Bolt framework.

## Setup

1. Create a new Slack app at https://api.slack.com/apps
2. Enable Socket Mode in your app settings
3. Add the following bot token scopes:
   - `commands`
   - `chat:write`
   - `app_mentions:read`
4. Create a `.env` file in the root directory with the following variables:
   ```
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   ```
5. Install dependencies:
   ```bash
   npm install
   ```

## Running the App

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Available Commands

- `/hello` - Responds with a greeting message

## Development

The app is built using:
- Node.js
- @slack/bolt framework
- Socket Mode for real-time communication 