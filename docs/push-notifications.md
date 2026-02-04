---
title: "Push Notifications"
date: 2026-02-04
---

# Push Notifications (Webhook Receiver)

Liquid Mail ships a small local webhook receiver for “true push” (no polling).

This is **off by default** and only runs when you start it.

## Start the server

```bash
liquid-mail push --port 8808
```

By default it binds to `127.0.0.1` and listens on `/hook`.

## Send a test event

```bash
curl -sS -X POST http://127.0.0.1:8808/hook \
  -H 'content-type: application/json' \
  -d '{"event":"test","title":"Hello","body":"It works"}'
```

## Optional: desktop notifications (macOS)

```bash
liquid-mail push --notify
```

## Optional: secret header

```bash
liquid-mail push --secret supersecret
```

Then include:

```bash
curl -sS -X POST http://127.0.0.1:8808/hook \
  -H 'content-type: application/json' \
  -H 'x-liquid-mail-secret: supersecret' \
  -d '{"event":"test","title":"Hello","body":"It works"}'
```

## Optional: post webhook events into a topic

```bash
liquid-mail push --topic push-inbox
```

All webhook events will be posted as messages into `push-inbox`.

