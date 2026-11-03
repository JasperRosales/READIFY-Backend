# READIFY — Database Schema (Supabase / PostgreSQL)

> **Aim:** Fight illiteracy for children, teens, and adults through voiced English-fundamentals
> lessons and AI-checked (Gemini) tests.

This document is shared by **READIFY-Backend** and **READIFY-Frontend**. Keep both copies in sync.

---

## 1. Overview

| Area | Tables |
|---|---|
| Accounts & progress level | `profiles` (+ Supabase `auth.users`) |
| Learning page | `chapters`, `chapter_sections`, `section_assets` |
| Chapter quizzes (optional MC / fill-in-the-blank) | `quiz_questions`, `quiz_choices`, `quiz_attempts`, `quiz_answers` |
| Testing page (essay / identification) | `tests`, `test_items`, `test_attempts`, `test_responses` |
| AI checker (Gemini) | `ai_evaluations` |
| User progression | `chapter_progress`, `levels`, `xp_events` |

```
auth.users ─1:1─ profiles ─┬─< chapter_progress >─ chapters ─┬─< chapter_sections ─< section_assets
                           ├─< quiz_attempts ─< quiz_answers  ├─< quiz_questions ─< quiz_choices
                           ├─< test_attempts ─< test_responses ─1:1─ ai_evaluations
                           └─< xp_events                      └─< tests ─< test_items
levels (lookup by xp)
```

---

## 2. Authentication (register & log in via email)

Use **Supabase Auth** (email + password, with email confirmation). Do **not** store passwords in
our own tables. `auth.users` is managed by Supabase; we extend it with `public.profiles`, created
automatically by a trigger on sign-up (see §6).

---

## 3. Enums

```sql
create type age_group        as enum ('child', 'teen', 'adult');
create type user_role        as enum ('learner', 'admin');
create type narration_source as enum ('human', 'tts');           -- voiced by us vs. by a bot
create type asset_kind       as enum ('image', 'illustration', 'animation', 'audio');
create type question_kind    as enum ('multiple_choice', 'fill_in_blank');
create type test_item_kind   as enum ('story_comprehension', 'error_finding', 'tense_usage');
create type answer_format    as enum ('essay', 'identification');
create type progress_status  as enum ('not_started', 'in_progress', 'completed');
create type attempt_status   as enum ('in_progress', 'submitted', 'graded', 'grading_failed');
```

---

## 4. Tables

### 4.1 Accounts & levels

```sql
create table public.levels (
  level        int primary key,                 -- 1, 2, 3, ...
  title        text not null,                   -- e.g. 'Beginner Reader'
  min_xp       int  not null unique check (min_xp >= 0)
);

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  display_name  text,
  avatar_url    text,
  age_group     age_group,
  role          user_role not null default 'learner',
  total_xp      int not null default 0 check (total_xp >= 0),
  current_level int not null default 1 references public.levels(level),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 4.2 Learning page (voiced chapters)

```sql
create table public.chapters (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,           -- 'nouns', 'verbs', 'tenses' ...
  title         text not null,
  summary       text,
  order_index   int  not null unique,           -- lesson-plan order
  cover_url     text,
  target_ages   age_group[] not null default '{child,teen,adult}',
  unlock_level  int not null default 1 references public.levels(level),
  xp_reward     int not null default 50,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A chapter is split into sections; each section is one narrated block of text.
create table public.chapter_sections (
  id                uuid primary key default gen_random_uuid(),
  chapter_id        uuid not null references public.chapters(id) on delete cascade,
  order_index       int  not null,
  heading           text,
  body_text         text not null,              -- text that lights up while being read
  analogy           text,                       -- "a noun is like a name tag..."
  audio_url         text,                       -- Supabase Storage: narration/...
  narration_source  narration_source not null default 'tts',
  narrator          text,                       -- voice actor name or TTS voice id
  word_timings      jsonb,                      -- for text highlighting, see below
  duration_ms       int,
  unique (chapter_id, order_index)
);

-- Visuals / analogies attached to a section.
create table public.section_assets (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.chapter_sections(id) on delete cascade,
  kind         asset_kind not null default 'illustration',
  url          text not null,                   -- Supabase Storage: chapter-assets/...
  alt_text     text not null,                   -- accessibility
  caption      text,
  order_index  int not null default 0
);
```

**`word_timings` format** (drives the "text lights up while voice reads" feature):

```json
[
  { "word": "A",    "start_ms": 0,   "end_ms": 180, "char_start": 0, "char_end": 1 },
  { "word": "noun", "start_ms": 180, "end_ms": 560, "char_start": 2, "char_end": 6 }
]
```

- **TTS:** most TTS APIs (e.g. Google Cloud TTS SSML marks, Azure, ElevenLabs) can return
  word/character timestamps; save them here when the audio is generated.
- **Human narration:** generate timings with a forced-aligner (e.g. Gentle, Aeneas, WhisperX).
- The frontend uses `audio.currentTime` to find the active word and highlight
  `body_text[char_start:char_end]`.

### 4.3 Chapter quizzes (optional MC / fill-in-the-blank)

```sql
create table public.quiz_questions (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references public.chapters(id) on delete cascade,
  order_index     int  not null,
  kind            question_kind not null,
  prompt          text not null,                -- use '___' for the blank
  accepted_answers text[],                      -- fill_in_blank: case-insensitive matches
  explanation     text,                         -- shown after answering
  unique (chapter_id, order_index)
);

create table public.quiz_choices (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions(id) on delete cascade,
  label        text not null,
  is_correct   boolean not null default false,
  order_index  int not null default 0
);

create table public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  chapter_id    uuid not null references public.chapters(id) on delete cascade,
  score         int not null default 0,
  max_score     int not null default 0,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create table public.quiz_answers (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id   uuid not null references public.quiz_questions(id) on delete cascade,
  choice_id     uuid references public.quiz_choices(id),   -- multiple_choice
  text_answer   text,                                      -- fill_in_blank
  is_correct    boolean not null,
  unique (attempt_id, question_id)
);
```

### 4.4 Testing page (essay / identification, AI-checked)

```sql
create table public.tests (
  id            uuid primary key default gen_random_uuid(),
  chapter_id    uuid references public.chapters(id) on delete set null, -- null = general test
  title         text not null,
  instructions  text,
  target_ages   age_group[] not null default '{child,teen,adult}',
  unlock_level  int not null default 1 references public.levels(level),
  xp_reward     int not null default 100,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.test_items (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references public.tests(id) on delete cascade,
  order_index     int  not null,
  kind            test_item_kind not null,
  answer_format   answer_format  not null,
  passage         text,            -- story_comprehension: the story to read
  prompt          text not null,   -- "Explain why the boy...", "Find the error in:", "Rewrite in past tense:"
  reference_answer text,           -- model answer / expected correction (given to the AI, never to the client)
  rubric          jsonb,           -- grading criteria for the AI, see §5
  max_points      int not null default 10,
  unique (test_id, order_index)
);

create table public.test_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  test_id       uuid not null references public.tests(id) on delete cascade,
  status        attempt_status not null default 'in_progress',
  total_score   numeric(6,2),
  max_score     int,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  graded_at     timestamptz
);

create table public.test_responses (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.test_attempts(id) on delete cascade,
  item_id       uuid not null references public.test_items(id) on delete cascade,
  answer_text   text not null,
  created_at    timestamptz not null default now(),
  unique (attempt_id, item_id)
);

-- One AI grading result per response. Kept separate so we can re-grade and audit.
create table public.ai_evaluations (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null unique references public.test_responses(id) on delete cascade,
  model         text not null,                -- e.g. 'gemini-2.5-flash'
  score         numeric(5,2) not null,
  max_points    int not null,
  feedback      text not null,                -- friendly explanation for the learner
  corrections   jsonb,                        -- [{ "original": "...", "suggestion": "...", "reason": "..." }]
  raw_output    jsonb,                        -- full model JSON, for debugging
  created_at    timestamptz not null default now()
);
```

### 4.5 User progression

```sql
create table public.chapter_progress (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  chapter_id       uuid not null references public.chapters(id) on delete cascade,
  status           progress_status not null default 'not_started',
  last_section_id  uuid references public.chapter_sections(id) on delete set null, -- resume point
  best_quiz_score  int,
  started_at       timestamptz,
  completed_at     timestamptz,
  primary key (user_id, chapter_id)
);

-- Append-only XP ledger; profiles.total_xp / current_level are derived from it.
create table public.xp_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      int  not null,
  reason      text not null,                  -- 'chapter_completed', 'quiz_passed', 'test_graded'
  source_id   uuid,                           -- chapter / quiz_attempt / test_attempt id
  created_at  timestamptz not null default now(),
  unique (user_id, reason, source_id)         -- no double-awarding
);
```

### 4.6 Indexes

```sql
create index on public.chapter_sections (chapter_id, order_index);
create index on public.quiz_questions   (chapter_id);
create index on public.quiz_attempts    (user_id, chapter_id);
create index on public.test_items       (test_id, order_index);
create index on public.test_attempts    (user_id, test_id);
create index on public.test_responses   (attempt_id);
create index on public.xp_events        (user_id);
```

---

## 5. AI checker integration (Gemini)

**Never call Gemini from the browser** — the API key would be exposed. Grade in a
**Supabase Edge Function** (`grade-test-attempt`) using the service-role key.

Flow:

1. Learner submits → frontend sets `test_attempts.status = 'submitted'` and calls the Edge Function
   with the `attempt_id`.
2. Edge Function loads each `test_response` with its `test_item` (`prompt`, `passage`,
   `reference_answer`, `rubric`, `max_points`).
3. Sends Gemini a prompt per item asking for **structured JSON output**
   (`responseMimeType: "application/json"` + `responseSchema`):
   ```json
   { "score": 7, "feedback": "Good job explaining...", "corrections": [ ... ] }
   ```
4. Clamps `score` to `0..max_points`, inserts into `ai_evaluations`, sums into
   `test_attempts.total_score`, sets `status = 'graded'` (or `'grading_failed'` on error so it can
   be retried), and inserts an `xp_events` row.

Example `rubric`:

```json
{
  "criteria": [
    { "name": "Understands the main idea", "points": 4 },
    { "name": "Uses evidence from the story", "points": 3 },
    { "name": "Grammar and spelling", "points": 3 }
  ],
  "tone": "encouraging, simple words for the learner's age group"
}
```

Pass `profiles.age_group` into the prompt so feedback suits a child vs. an adult.

---

## 6. Functions & triggers

```sql
-- Create a profile on sign-up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep total_xp and current_level in sync with the XP ledger
create function public.apply_xp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
     set total_xp      = p.total_xp + new.amount,
         current_level = (select max(level) from public.levels
                          where min_xp <= p.total_xp + new.amount),
         updated_at    = now()
   where p.id = new.user_id;
  return new;
end $$;

create trigger on_xp_event
  after insert on public.xp_events
  for each row execute function public.apply_xp();
```

---

## 7. Row Level Security

Enable RLS on **every** table. Summary:

| Table | Learner (authenticated) | Admin |
|---|---|---|
| `levels` | read | all |
| `profiles` | read/update **own** row (not `role`, `total_xp`, `current_level`) | all |
| `chapters`, `chapter_sections`, `section_assets`, `quiz_questions`, `tests` | read where published | all |
| `quiz_choices` | read (but **don't select `is_correct`** — grade via RPC) | all |
| `test_items` | read via view `test_items_public` (excludes `reference_answer`, `rubric`) | all |
| `quiz_attempts`, `quiz_answers`, `test_attempts`, `test_responses`, `chapter_progress` | read/insert/update **own** | all |
| `ai_evaluations` | read **own** (via response → attempt) | all |
| `xp_events` | read **own**; inserts only by server (service role / security-definer RPC) | all |

Example policies:

```sql
alter table public.profiles enable row level security;

create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

alter table public.chapters enable row level security;
create policy "published chapters" on public.chapters for select
  using (is_published or exists (select 1 from public.profiles
                                 where id = auth.uid() and role = 'admin'));

alter table public.test_attempts enable row level security;
create policy "own attempts" on public.test_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create view public.test_items_public with (security_invoker = true) as
  select id, test_id, order_index, kind, answer_format, passage, prompt, max_points
  from public.test_items;
```

Protect `role`, `total_xp`, `current_level` with column-level grants or a `before update`
trigger so learners can't promote themselves or give themselves XP.

---

## 8. Storage buckets

| Bucket | Public | Contents |
|---|---|---|
| `narration` | yes (read) | chapter section audio (`<chapter_slug>/<section_order>.mp3`) |
| `chapter-assets` | yes (read) | illustrations, visual examples, analogies |
| `ui-assets` | yes (read) | logo, button art, page icons (Learning / Testing) |
| `avatars` | yes (read) | user avatars (`<user_id>/avatar.png`), write own only |

---

## 9. Seed data (starter)

```sql
insert into public.levels (level, title, min_xp) values
  (1, 'Beginner Reader', 0),
  (2, 'Word Explorer',   200),
  (3, 'Sentence Builder', 500),
  (4, 'Story Reader',    1000),
  (5, 'Confident Reader', 2000);
```

Suggested chapter order (English fundamentals — lesson plan TBD by content team):
1. Alphabet & Phonics → 2. Nouns → 3. Pronouns → 4. Verbs → 5. Adjectives & Adverbs →
6. Sentence Structure → 7. Tenses (Past / Present / Future) → 8. Punctuation →
9. Reading Comprehension.

---

## 10. Open decisions

- **Narration: human vs. bot.** The schema supports both per section (`narration_source`).
  Recommended: start with **TTS** (fast, consistent, gives word timings for free), and replace key
  chapters with human recordings later if time allows.
- **Gemini model & prompt** — owned by the AI checker team; store the final prompt in the Edge
  Function source.
- Website name, logo, color scheme, fonts, and assets — frontend/graphics team.
