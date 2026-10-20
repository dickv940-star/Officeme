# W001 Apps Script acceptance checklist

## Local deterministic sample
- Products: 3
- Clicks: 200
- Orders: 11
- Commission: 39000 IDR
- Orders/clicks: 5.5%

## Backend checks after the owner deploys it
- Wrong token: returns an access-denied result.
- Missing Script Properties: reports configuration error without exposing values.
- Wrong parent origin: bridge ignores the message.
- Invalid metrics or more than 30 products: rejected.
- Gemini quota HTTP 429: user receives a quota message.
- Gemini key is never returned to browser or stored in Git.
- Only a non-empty response from the live Gemini API is considered an AI success.

## Status terminology
- Code committed: implementation exists in the test branch.
- Local sample passed: deterministic CSV math passed.
- Backend configured: Script Properties and web-app deployment completed.
- Gemini live test passed: real API request returned a model name and non-empty analysis.
