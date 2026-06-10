# Firebase Security Rules

Paste these into your Firebase Console.

---

## Firestore Rules
Console → Firestore Database → Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Players — read by anyone logged in, write only by self
    match /players/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;

      // Match history sub-collection
      match /matchHistory/{matchId} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Matchmaking queue — authenticated users only
    match /matchmakingQueue/{uid} {
      allow read, write: if request.auth != null;
    }

    // Matches — authenticated users who are in the match
    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Invites — sender or receiver only
    match /invites/{inviteId} {
      allow read:   if request.auth != null &&
                      (resource.data.fromUid == request.auth.uid ||
                       resource.data.toUid   == request.auth.uid);
      allow create: if request.auth != null &&
                      request.resource.data.fromUid == request.auth.uid;
      allow update: if request.auth != null &&
                      (resource.data.fromUid == request.auth.uid ||
                       resource.data.toUid   == request.auth.uid);
    }
  }
}
```

---

## Realtime Database Rules
Console → Realtime Database → Rules

```json
{
  "rules": {
    "matches": {
      "$matchId": {
        ".read":  "auth != null",
        ".write": "auth != null"
      }
    },
    "presence": {
      "$uid": {
        ".read":  "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```
