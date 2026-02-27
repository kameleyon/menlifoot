

# Football Quiz Feature for Menlifoot

## Overview
A new "Quiz" section where users play timed trivia games -- guessing players, teams, or stats. The quiz displays a two-column table (like the reference images) in the Menlifoot black/gold color scheme. Users type answers to fill in the table within a 5-minute timer.

## Database Design

### `quizzes` table
Stores each quiz definition:
- `id` (uuid, PK)
- `title` (text) -- e.g. "Name the 20 players with the most CL knockout appearances"
- `description` (text, nullable)
- `thumbnail_url` (text, nullable)
- `time_limit_seconds` (int, default 300 = 5 min)
- `is_published` (bool, default false)
- `created_by` (uuid, nullable)
- `created_at`, `updated_at` (timestamps)

### `quiz_items` table
Each answer row in the quiz:
- `id` (uuid, PK)
- `quiz_id` (uuid, FK -> quizzes)
- `answer` (text) -- the correct answer (e.g. "Cristiano Ronaldo")
- `acceptable_answers` (text[], nullable) -- alternative spellings (e.g. ["CR7", "Ronaldo"])
- `hint` (text, nullable) -- optional hint (login required to see)
- `display_value` (text, nullable) -- extra info shown in the cell (e.g. "85" for appearances)
- `sort_order` (int) -- position in the table
- `created_at` (timestamp)

### `quiz_attempts` table
Tracks user scores:
- `id` (uuid, PK)
- `quiz_id` (uuid, FK -> quizzes)
- `user_id` (uuid, nullable) -- null for anonymous players
- `score` (int)
- `total_items` (int)
- `time_taken_seconds` (int)
- `completed_at` (timestamp)

### RLS Policies
- `quizzes`: public read (published only), admin insert/update/delete
- `quiz_items`: public read, admin insert/update/delete
- `quiz_attempts`: insert for all (anonymous allowed), users read own attempts

## Frontend Pages & Components

### 1. Quiz Listing Page (`/quizzes`)
- Grid of quiz cards showing thumbnail, title, description
- Black/gold Menlifoot styling, same layout pattern as Articles page
- Each card links to the individual quiz

### 2. Quiz Play Page (`/quizzes/:id`)
- **Start Modal**: Shows quiz title + rules, "Start Quiz" button
- **Game View**:
  - Timer counting down from 5:00 (top bar, gold accent)
  - Score counter: "X / Y found"
  - Text input at top for typing guesses
  - Two-column table displaying items:
    - Found answers: gold/primary background with checkmark
    - Unfound answers: dark/muted background (hidden text)
  - "Give Up" button to reveal all answers
  - "Hint" button -- if not logged in, shows prompt to create account; if logged in, reveals hint
- **Results View** (time up or give up):
  - Final score display
  - Full table revealed -- found items highlighted in gold, missed items shown in muted/secondary color
  - "Play Again" and "Browse Quizzes" buttons

### 3. Navigation
- Add "Quiz" link to `navLinks` array in Navbar (between Articles and Ask Menlifoot)
- Add translation keys for all 4 languages

### 4. Admin Panel
- New "Quizzes" tab in Admin page
- Create quiz: title, description, thumbnail, time limit
- Add/edit/remove quiz items (answer, acceptable answers, hint, display value, sort order)
- Publish/unpublish toggle

## Technical Details

### Answer Matching Logic
- Case-insensitive comparison
- Trim whitespace
- Check against both `answer` and all `acceptable_answers`
- Immediate feedback: correct answer lights up gold in the table

### Files to Create
- `src/pages/Quizzes.tsx` -- listing page
- `src/pages/QuizPlay.tsx` -- individual quiz game page
- `src/components/QuizCard.tsx` -- card for listing
- `src/components/QuizGame.tsx` -- game logic component
- `src/components/QuizResultsTable.tsx` -- results display

### Files to Modify
- `src/App.tsx` -- add routes `/quizzes` and `/quizzes/:id`
- `src/components/Navbar.tsx` -- add Quiz nav link
- `src/contexts/LanguageContext.tsx` -- add translation keys
- `src/pages/Admin.tsx` -- add Quizzes management tab

### Color Mapping (reference -> Menlifoot)
- Green/lime backgrounds -> Gold/primary (`bg-primary`, `bg-primary/20`)
- Purple backgrounds -> Dark/secondary (`bg-secondary`, `bg-muted`)
- Text -> White/foreground on dark, black on gold

