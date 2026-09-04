<!--
  DRAFT. English version of legal/gizlilik-politikasi.md. Keep the two in step:
  if one changes, change both.

  Before publishing:
   1. BEFORE PUBLISHING: make sure iletisim@buaksamnepisireyim.com actually
      receives mail. A policy naming an unreachable contact is worse than one
      with no contact, and Apple requires it to stay reachable for as long as
      the app is listed. Registrar email forwarding is enough.
   2. Have a lawyer read it. Sofra stores dietary filters. These are cooking
      settings, not medical records — a user may set "gluten-free" because a
      child or a guest is coeliac — so this draft does not claim they are
      special-category data under KVKK art. 6 / GDPR art. 9. The residual risk
      is that a regulator reads a filter as *inferred* health data about the
      account holder; the draft minimises that by using them for nothing but
      recipe filtering. That judgement call belongs to a lawyer, not to this
      file. Not legal advice.
   3. The "Security" section currently admits recipe traffic is unencrypted.
      Update it once the API is served over HTTPS.
-->

# Sofra — Privacy Policy

**Effective date:** 4 September 2026

## 1. Who is responsible

Sofra is published and operated by Yigit Berktaş as an individual. "We" in this
policy means that. Contact: iletisim@buaksamnepisireyim.com

## 2. In short

- You can use Sofra as a guest, without an account. Nothing is sent to the
  cloud; everything stays on your device.
- If you create an account, your preferences and pantry sync across devices.
- No ads, no analytics or tracking tools, and we do not sell your data.
- You can permanently delete your account from inside the app.

## 3. What we process

### 3.1 Account data

If you choose to create an account, authentication runs through Google Firebase
Authentication:

- **Email sign-up:** your email address and password. We never see the
  password; Firebase stores it hashed.
- **Sign in with Apple:** the user identifier Apple provides, and an email
  address. If you use Apple's "Hide My Email", we only ever see the relay
  address.
- **Sign in with Google:** your Google account identifier and email address.

### 3.2 App preferences and content

With an account, the following is stored in Firestore at
`users/{your-user-id}/app/state` and synced to your devices:

- time budget and maximum cost per person,
- **dietary preferences: meatless, vegetarian/vegan, gluten-free,
  lactose-free, low-glycemic**,
- your cooking experience level,
- the ingredients in your pantry and kitchen,
- your shopping list,
- which recipes you liked, cooked or marked "not for me", and the taste
  preferences learned from those.

### 3.3 A note about the dietary filters

Meatless, gluten-free, lactose-free and low-glycemic are **cooking filters**,
not medical records. People often cook for someone other than themselves: you
may set these for a child, a guest, or anyone else at the table. Sofra draws no
conclusion about your health, or anyone else's, from them, and keeps no such
record.

We use these settings only to filter the recipes we show you — never for
profiling, advertising, or sharing with third parties. You do not have to set
any of them; Sofra works without them, you can change them at any time, and
deleting your account removes them entirely.

> **Important:** these filters rely on ingredient matching in the recipe data
> and are not perfect. If a restriction is medically necessary — coeliac
> disease, lactose intolerance, diabetes — check the ingredient list yourself
> before cooking a recipe. Sofra does not give medical advice and is not a
> medical device.

### 3.4 Data that stays on your device

Your language choice, whether you have seen the introduction, and your daily
reminder settings are stored only on your device (AsyncStorage). In guest mode,
all of the preferences above stay on your device too.

### 3.5 Server logs

Recipe and price data come from our own API server. That server records the IP
address and requested path of each request as a technical log. These logs exist
for debugging and abuse prevention, are not used for marketing, and are not
linked to your account — API requests carry no account identifier.

### 3.6 What we do not process

We do not use location, contacts, photos, advertising identifiers, device
fingerprinting or cookies. The app contains no analytics, crash reporting or
advertising tools. Reminders are scheduled locally on your device; we do not
generate or collect remote push tokens.

## 4. Purposes and legal bases

| Data | Purpose | Basis |
| --- | --- | --- |
| Account data | Creating your account and signing you in | Performance of a contract |
| Preferences, pantry, lists | Running the app and syncing across devices | Performance of a contract |
| Dietary filters | Filtering the recipes shown | Performance of a contract |
| Taste feedback | Improving suggestions for you | Performance of a contract |
| Server logs | Security, debugging, abuse prevention | Legitimate interest |

## 5. Sharing and international transfers

We do not sell your data and do not share it for advertising. To run the
service we use:

- **Google Firebase (Authentication and Cloud Firestore)** — hosting account
  and preference data. Google servers may be located outside Türkiye.
- **Apple** — authentication, if you use Sign in with Apple.
- **Google** — authentication, if you use Sign in with Google.

These providers process the data on our behalf. Transfers abroad are made under
KVKK's transfer provisions and on the basis of your explicit consent.

We collect market prices from external sources to estimate recipe costs. Those
requests contain **no user data**.

## 6. Retention

- Account and preference data: for as long as your account exists.
- When you delete your account: your preference and pantry data in Firestore
  and your Firebase Authentication account are deleted, and the local copy on
  your device is removed.
- Server technical logs: we aim to keep these for no more than 30 days.

## 7. Deleting your account

In the app, go to **Profilim → Hesap ve güvenlik → Hesabımı sil** (Profile →
Account and security → Delete my account). For security you will first be asked
to sign in again with your password or your Apple/Google account. Deletion
cannot be undone.

## 8. Your rights

Under KVKK art. 11 and, where it applies to you, the GDPR, you have the right
to know whether your data is processed, to access it, to have it corrected or
deleted, to object to processing, and to withdraw your consent. Write to
iletisim@buaksamnepisireyim.com and we will respond as soon as possible, and in any case
within thirty days.

## 9. Security

Authentication and preference syncing run over encrypted connections to Google
Firebase. Firestore rules allow each user to read and write only their own data.

> **Current limitation:** the API serving recipes and prices still runs over an
> unencrypted connection (HTTP). Those requests carry no account details or
> password, but the ingredients you tick in your pantry and your dietary
> preferences could be read by someone monitoring the network. We are working
> on encrypting this connection.

## 10. Children

Sofra is not directed at children under 13 and we do not knowingly collect data
from them.

## 11. Changes

If we update this policy we will change the effective date and announce
material changes in the app.

## 12. Contact

iletisim@buaksamnepisireyim.com
