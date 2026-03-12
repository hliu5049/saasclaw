# Migration to OpenClaw JSON-RPC 2.0 Protocol

## Overview

This migration updates the Gateway Client to be compatible with the official OpenClaw JSON-RPC 2.0 WebSocket protocol.

## Changes Made

### 1. New Gateway Client (`client-v2.ts`)

Created a new `GatewayClientV2` class that implements the OpenClaw JSON-RPC 2.0 protocol:

**Protocol Changes:**
- Request format: Custom → JSON-RPC 2.0 standard
- Response format: `{type, id, result}` → `{id, ok, payload, error}`
- Authentication: Ed25519 signature → `connect` method with token
- Event format: `{type: "event"}` → `{event: "name", payload: {}}`

**Method Name Changes:**
| Old Method | New Method | Parameters |
|------------|------------|------------|
| `chatSend(agentId, sessionKey, message)` | `agentSend(message, sessionKey, runId?)` | Reordered params |
| `chatHistory(agentId, sessionKey, opts)` | `chatHistory(sessionKey, opts)` | Removed agentId |
| `configPatch(agentId, patch)` | `configPatch(agentId, patch)` | Same |
| `configGet(agentId)` | `configGet(agentId)` | Same |

### 2. Updated Files

#### `apps/backend/src/gateway/pool.ts`
- Import `GatewayClientV2` instead of `GatewayClient`
- Removed `gatewayId` parameter from client constructor
- Added `authenticated` event listener

#### `apps/backend/src/chat/routes.ts`
- Changed `gwClient.chatSend(agentId, key, message)` → `gwClient.agentSend(message, key)`
- Changed `gwClient.chatHistory(agentId, key, opts)` → `gwClient.chatHistory(key, opts)`
- Added better error handling with timeout detection

#### `apps/backend/src/channels/routes.ts`
- Changed `gwClient.chatSend(agentDbId, sessionKey, userMsg)` → `gwClient.agentSend(userMsg, sessionKey)`

#### `apps/backend/src/agents/service.ts`
- No changes needed - `configPatch` method signature remains the same

### 3. New Features

**Authentication Flow:**
1. WebSocket connects
2. Client automatically sends `connect` RPC method
3. Gateway responds with authentication result
4. Client emits `authenticated` event on success

**Event Handling:**
- `agent` events are forwarded to `agent-event` listeners
- `tick` events (heartbeat) are handled internally
- Other events are emitted as generic `event` with name and payload

**Error Handling:**
- JSON-RPC 2.0 error format: `{code: string, message: string}`
- Better timeout error messages
- Automatic reconnection on disconnect

## Testing

### Before Deployment

1. **Verify Gateway is Running:**
```bash
ss -tuln | grep 18789
```

2. **Check Gateway Logs:**
Look for connection and authentication messages

3. **Test Agent Creation:**
```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Agent"}'
```

4. **Test Chat:**
```bash
curl -X POST http://localhost:3001/api/chat/AGENT_ID/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

### Expected Log Output

```
[GatewayPool] Gateway xxx connected to ws://127.0.0.1:18789
[GatewayPool] Gateway xxx authenticated successfully
```

### Troubleshooting

**If you see "RPC timeout":**
1. Check if Gateway is running: `ss -tuln | grep 18789`
2. Check Gateway logs for errors
3. Verify Gateway implements JSON-RPC 2.0 protocol
4. Check if Gateway has the agent configuration

**If you see "Not authenticated":**
1. Check if token is configured in database
2. Verify Gateway accepts the token
3. Check Gateway authentication logs

**If you see "Gateway unavailable":**
1. Gateway is not in the database
2. Gateway WebSocket connection failed
3. Check `OPENCLAW_GATEWAY_URL` environment variable

## Rollback Plan

If the migration causes issues, you can rollback by:

1. Revert `pool.ts` to use old `GatewayClient`:
```typescript
import { GatewayClient } from "./client";
```

2. Revert method calls in `chat/routes.ts` and `channels/routes.ts`:
```typescript
await gwClient.chatSend(agentId, key, message);
await gwClient.chatHistory(agentId, key, opts);
```

3. Restart the backend service

## Next Steps

1. Monitor logs for connection and authentication events
2. Test chat functionality with a real agent
3. Verify SSE streaming works correctly
4. Consider removing old `client.ts` after confirming stability
5. Update documentation with new protocol details

## References

- [OpenClaw WebSocket Protocol](https://openclaw-openclaw.mintlify.app/api/websocket)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
