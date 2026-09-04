# Sofra project brief

## Product promise

Sofra helps a user decide what to cook tonight based on available time, estimated
cost, dietary preferences, seasonality, pantry contents, and prior feedback.

## Current product rules

- The interface defaults to Turkish; English remains available.
- Cost estimates use daily average market prices for Istanbul. The profile does not
  ask the user to choose a pricing city.
- `Beğendim` and `Pişirdim` are independent. Only `Beğendim` changes taste signals.
- `Bana göre değil` should suppress unsuitable future recommendations and remain
  reversible from the profile.
- Suggestions must respect vegetarian/meatless, gluten-free, lactose-free, and
  low-glycemic filters consistently.
- Pantry ranking prioritizes matching ingredients and a selected suitable main
  protein. Ties favor the more detailed recipe.
- A recipe without a trustworthy cost must not display a misleading zero or
  implausibly low estimate.
- Preparation/storage articles are quarantined rather than offered as meals.

## Architecture

- Client: React Native, Expo SDK 54, Expo Router.
- Authentication and user cloud data: Firebase Authentication and Firestore.
- API: FastAPI/Uvicorn at `http://129.121.89.248:8000`.
- VPS service: `sofra-api.service`; deployment helper: `/usr/local/sbin/deploy-sofra`.
- Repository: `Yigit-App-lab/Sofra`, branch `main`.
- iOS/Android application identifier: `com.yberktas.sofra`.
- EAS project: `@yigitberktas/sofra-app`.

## Where information lives

| Need | Source |
| --- | --- |
| Current priorities and acceptance criteria | `TODO.md` |
| Completed work, deployments and rollback points | `PROJECT_HISTORY.md` |
| Mobile test/build commands and troubleshooting | `TESTING.md` |
| How to request and verify work with Codex | `HOW_TO_GUIDE_CODEX.md` |
| Product intent and non-negotiable rules | `PROJECT_BRIEF.md` |
| Agent working protocol | `AGENTS.md` |
| App scripts and dependency versions | `package.json` |
| Native identifiers/plugins | `app.json` and `eas.json` |
| Ranking and cost behavior | `src/engine.js` and its tests |

## Definition of done

A change is complete only when its acceptance criteria are met, relevant automated
checks pass, device testing needs are stated, documentation is updated when needed,
and deployment/rebuild status is unambiguous.
