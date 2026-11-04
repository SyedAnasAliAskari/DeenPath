# PHP API contract

Use `https://EXISTING-DOMAIN/salahguard/api.php?route=/v1/ROUTE`. PATH_INFO `/api.php/v1/ROUTE` is optional. Requests and responses are JSON, except multipart uploads and authenticated binary downloads. Send `Authorization: Bearer TOKEN` on protected routes. Errors return `{"error":"safe message"}` with a suitable HTTP status. All production requests must be HTTPS.

| Method | Route | Body/purpose |
|---|---|---|
| GET | `health` | Minimal deployment check |
| POST | `auth/register` | `{name,email,password}`; returns `{user,token}` |
| POST | `auth/login` | `{email,password}`; returns `{user,token}` |
| POST | `auth/refresh` | `{}`; rotates token, extends expiry 30 days; two-minute retry grace |
| POST | `auth/logout` | `{}`; revokes this session |
| POST | `auth/reset/request` | `{email}`; generic response; mail must be configured |
| POST | `auth/reset/confirm` | `{code,password}`; consumes code and revokes all sessions |
| POST | `auth/verify/request` | Authenticated; sends code if mail configured |
| POST | `auth/verify/confirm` | `{code}`; consumes verification code |
| GET/PATCH/DELETE | `profile` | Read; update `{name,dob,email,currentPassword}` (password required only when changing email); delete with `{currentPassword}` |
| POST | `profile/password` | `{currentPassword,password}`; revokes other sessions; returns fresh token |
| GET | `profile/export` | Account data/metadata; file bytes downloaded separately |
| GET | `prayers`, `qaza`, `routines`, `completions`, `tasbih` | Own nondeleted records |
| POST/PATCH | Above routes, optionally `/record-id` | `{operationId,id,version,data}` |
| DELETE | Above `/record-id` | `{operationId,version,data}`; versioned correction/tombstone |
| POST | `sync/push` | Batch envelope below, up to 50 operations |
| GET | `sync/pull/CURSOR` | Incremental `{records,cursor,more}`, up to 200 changes |
| GET | `sync/status` | Storage, wallet, streaks and ledger |
| GET | `streaks`, `streaks/ledger` | Revalidated derived status/ledger |
| POST | `streaks/process` | Same idempotent derived reward processing |
| GET | `files` | Own metadata, no private disk names |
| POST | `files` | multipart `file`, UUID `id`; optional `profile=1` for avatar |
| GET/DELETE | `files/UUID` | Ownership-checked download/delete |

Example sync request (generate real UUIDs):

```json
{
  "operations": [{
    "operationId": "7a7bb5b1-d571-4c62-9b41-c6d7b6943084",
    "record": {
      "entity": "prayer_records",
      "id": "2026-10-26:Fajr",
      "version": 0,
      "deleted": false,
      "data": {
        "day": "2026-10-26",
        "prayer": "Fajr",
        "completedAt": "2026-10-26T00:30:00.000Z"
      }
    }
  }]
}
```

Acknowledgment: `{"results":[{"version":1}]}`. Retrying the same operation UUID returns the same acknowledgment. A stale version yields `{"conflict":true,"record":{...current record...}}`; no mutation occurs. The caller must explicitly resolve it using a new operation UUID. Pull records contain `id,entity,version,data,deleted`.

Only six whitelisted entity tables can be changed through sync. Server-derived wallets, ledger, streaks and garden tables cannot be uploaded by a client. Canonical prayer/routine-period IDs are validated. All ownership comes from the authenticated session. SQL values use prepared statements; table names are selected only from a hardcoded whitelist.

Rate limiting: 5 registrations per IP/15 minutes, 15 requests per auth action/IP/15 minutes, protected requests 300/account-and-IP/minute, uploads 20/account-and-IP/hour. Limits are conservative shared-hosting defaults and can be adjusted in private source. Reset requests do not reveal whether an account exists. A shared NAT can hit the same IP budget.

Bearer tokens and reset/verification codes are random high-entropy values stored server-side only as SHA-256 hashes. Passwords use Argon2id when available, else PHP PASSWORD_DEFAULT. Minimum password length is 12 bytes, maximum 128. There are no cookies or direct APK/MySQL connections. Validate hosting Authorization forwarding before diagnosing app authentication errors.
