# Setting up "Continue with Google"

The button is built in. It uses Better Auth's Google provider: the browser goes
to Google's own sign-in page with the account chooser (`prompt=select_account`),
and OpenNote never sees a Google password. Until the two values below are set,
the button is shown but disabled with "Google sign-in is not set up on this
server yet".

## 1. Create the Google OAuth client (free)

1. Open <https://console.cloud.google.com/projectcreate> and create a project
   (e.g. `OpenNote`).
2. Open <https://console.cloud.google.com/auth/branding> (OAuth consent screen):
   - App name `OpenNote`, your support email, your developer email.
   - Audience: **External**.
   - While the app is in *Testing*, add your own Google account under
     **Audience → Test users**, otherwise Google answers `access_denied`.
3. Open <https://console.cloud.google.com/apis/credentials> →
   **Create credentials → OAuth client ID** → Application type
   **Web application**, name `OpenNote local`.
   - **Authorised JavaScript origins:** `http://localhost:5173`
   - **Authorised redirect URIs:** `http://localhost:5173/api/auth/callback/google`
   - No trailing slashes. The redirect URI is `BETTER_AUTH_URL` +
     `/api/auth/callback/google`, so the two must match.
4. Click **Create** and copy the **Client ID** and **Client secret**.

## 2. Put them in `.env` (never commit it)

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
```

Restart `npm run dev`. The API prints `Google sign-in: on`.

## 3. Test it for real

Open <http://localhost:5173/app/signin>, click **Continue with Google**, pick an
account on Google's page, and you should land on your dashboard. Pick
"Use another account" on Google's chooser to switch accounts.

## How accounts work together

- New Google user → an OpenNote account is created (email marked verified by Google).
- Returning Google user → signed into the same account.
- Existing OpenNote account with the same email → linked **only if** that
  account's email is already verified. An unverified account is never linked,
  so nobody can pre-register your address to capture your Google login.
- A Google-only account has no OpenNote password; "Continue with Email" refuses
  every password until the owner sets one via **Forgot password** (link sent to
  their inbox).

## When you go live

Add your https domain to the same OAuth client:
origin `https://yourdomain.com`, redirect URI
`https://yourdomain.com/api/auth/callback/google`, and publish the consent
screen (Audience → Publish app).
