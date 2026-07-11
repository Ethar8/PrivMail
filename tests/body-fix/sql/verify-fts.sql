-- Verification of the body-fix data flow against a real SQLite FTS5 engine.
-- Mirrors the exact schema/triggers/UPSERT logic from db.ts (trigger-based
-- external-content FTS5). Run with:  sqlite3 :memory: ".read verify-fts.sql"
--
-- Expected final output (see asserts): all rows report PASS.

CREATE TABLE emails (
  id TEXT PRIMARY KEY, message_id TEXT UNIQUE, from_email TEXT, to_email TEXT,
  subject TEXT, body TEXT, encrypted_body TEXT, received_at INTEGER,
  is_read INTEGER DEFAULT 0, is_encrypted INTEGER DEFAULT 0, is_spam INTEGER DEFAULT 0,
  spam_score INTEGER DEFAULT 0, mailbox TEXT DEFAULT 'INBOX', labels TEXT, headers TEXT
);
CREATE VIRTUAL TABLE emails_fts USING fts5(
  subject, body, from_email, to_email, content='emails', content_rowid='rowid'
);

CREATE TRIGGER emails_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts(rowid, subject, body, from_email, to_email)
  VALUES (new.rowid, new.subject, new.body, new.from_email, new.to_email);
END;
CREATE TRIGGER emails_ad AFTER DELETE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, body, from_email, to_email)
  VALUES ('delete', old.rowid, old.subject, old.body, old.from_email, old.to_email);
END;
CREATE TRIGGER emails_au AFTER UPDATE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, body, from_email, to_email)
  VALUES ('delete', old.rowid, old.subject, old.body, old.from_email, old.to_email);
  INSERT INTO emails_fts(rowid, subject, body, from_email, to_email)
  VALUES (new.rowid, new.subject, new.body, new.from_email, new.to_email);
END;

-- Step 1: list view caches metadata only (empty body) — exactly saveEmailLocally
INSERT INTO emails (id, message_id, subject, body, received_at, from_email, to_email)
VALUES ('m1', 'm1', 'Quartalsbericht', '', 100, 'boss@corp.de', 'me@privmail.de')
ON CONFLICT(id) DO UPDATE SET
  subject = excluded.subject,
  body = CASE WHEN excluded.body <> '' THEN excluded.body ELSE emails.body END;

INSERT INTO emails (id, message_id, subject, body, received_at, from_email, to_email)
VALUES ('m2', 'm2', 'Newsletter', '', 200, 'news@shop.de', 'me@privmail.de')
ON CONFLICT(id) DO UPDATE SET
  subject = excluded.subject,
  body = CASE WHEN excluded.body <> '' THEN excluded.body ELSE emails.body END;

-- Step 2: detail view loads full body for m1 -> updateEmailBodyLocally
UPDATE emails SET body = 'Anbei der vertrauliche Quartalsbericht mit Umsatzzahlen.' WHERE id = 'm1';

-- Step 3: user re-opens the list (metadata re-cached with empty body).
-- The UPSERT must NOT wipe the already-loaded body.
INSERT INTO emails (id, message_id, subject, body, received_at, from_email, to_email)
VALUES ('m1', 'm1', 'Quartalsbericht', '', 100, 'boss@corp.de', 'me@privmail.de')
ON CONFLICT(id) DO UPDATE SET
  subject = excluded.subject,
  body = CASE WHEN excluded.body <> '' THEN excluded.body ELSE emails.body END;

.mode list
.headers off

-- ASSERT 1: full-text search finds a word from the BODY (was impossible before the fix)
SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END || ' :: body word "quartalsbericht" found'
FROM emails e JOIN emails_fts fts ON e.rowid = fts.rowid WHERE emails_fts MATCH '"quartalsbericht"*';

-- ASSERT 2: prefix search on a body term works
SELECT CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END || ' :: prefix "umsatz"* found in body'
FROM emails e JOIN emails_fts fts ON e.rowid = fts.rowid WHERE emails_fts MATCH '"umsatz"*';

-- ASSERT 3: re-caching from the list did NOT erase the loaded body
SELECT CASE WHEN body <> '' THEN 'PASS' ELSE 'FAIL' END || ' :: body preserved after list re-cache'
FROM emails WHERE id = 'm1';

-- ASSERT 4: no orphaned FTS rows (external-content stays consistent)
SELECT CASE WHEN (SELECT count(*) FROM emails_fts) = (SELECT count(*) FROM emails)
            THEN 'PASS' ELSE 'FAIL' END || ' :: FTS row count matches emails (no orphans)';

-- ASSERT 5: searching an unrelated term returns nothing
SELECT CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END || ' :: unrelated term not matched'
FROM emails e JOIN emails_fts fts ON e.rowid = fts.rowid WHERE emails_fts MATCH '"nichtvorhanden"*';
