# Tambola Party - End-to-End (E2E) Test Plan

## Objective
To systematically verify the entire lifecycle of a Tambola game session, ensuring no dead-ends, functional bugs, or UI inconsistencies exist in the Host+Participant workflow.

---

## Test Scenarios

### 1. Host Game Setup
*   **Goal:** Verify host can initiate a game session.
*   **Test:**
    1.  Click "Host a Game" on landing page.
    2.  Enter valid number of players (e.g., 2).
    3.  Click "Generate Tickets & Start".
    4.  **Expected:** Host is redirected to `/host` dashboard; Game PIN is displayed.

### 2. Participant Join Flow
*   **Goal:** Verify participants can join an active game.
*   **Test:**
    1.  Open `/join` in a new browser tab.
    2.  Enter valid Name and Game PIN (from step 1).
    3.  Click "Enter Game".
    4.  **Expected:** Participant is redirected to `/game/[pin]` and assigned a 3x9 Tambola ticket.

### 3. Gameplay Loop
*   **Goal:** Verify interactive manual ticket marking and host number calling.
*   **Test:**
    1.  Host calls a number (e.g., 23).
    2.  **Expected:** 23 appears highlighted on Host board and is visually identified/marked by Participant on their ticket (Requires State Sync - *currently mocked*).

### 4. Prize Claiming & Validation
*   **Goal:** Verify automated prize claim validation logic.
*   **Test:**
    1.  **Invalid Claim:** Participant triggers claim for "Early 5" when fewer than 5 numbers are called.
        *   **Expected:** System alerts "Invalid claim".
    2.  **Valid Claim:** Participant triggers claim for "Early 5" after 5+ numbers on their ticket are called.
        *   **Expected:** System alerts "Success!", claim button becomes disabled/green.
    3.  **Cross-Check:** Host Dashboard reflects the winner's status.

### 5. UI/UX Consistency (Visual Checklist)
*   **Goal:** Ensure the vibrant party theme is consistent and accessible.
*   **Test:**
    *   **Visibility:** Verify high contrast on Host board (e.g., Indigo background with Yellow text).
    *   **Responsiveness:** Resize window to mobile width—verify tickets are still legible.
    *   **Interactivity:** Click targets for Claim buttons are large and clearly distinguishable.
