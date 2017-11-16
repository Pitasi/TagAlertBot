CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY,
  username VARCHAR(256),
  UNIQUE (id, username)
);

CREATE TABLE IF NOT EXISTS groups (
  groupId INTEGER,
  userId  INTEGER,
  PRIMARY KEY (groupId, userId)
);

CREATE TABLE IF NOT EXISTS groupSettings (
  groupId  INTEGER,
  everyone INTEGER,
  admin    INTEGER,
  PRIMARY KEY (groupId)
);

CREATE TABLE IF NOT EXISTS actionlog (
  action   VARCHAR(30000) NOT NULL,
  request  VARCHAR(30000),
  response VARCHAR(30000),
  time     TIMESTAMP DEFAULT current_timestamp
);
