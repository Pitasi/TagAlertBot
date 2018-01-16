ALTER TABLE actionlog
  ADD action_id SERIAL NOT NULL;

CREATE UNIQUE INDEX actionlog_action_id_uindex
  ON actionlog (action_id);

ALTER TABLE actionlog
  ADD CONSTRAINT actionlog_action_id_pk PRIMARY KEY (action_id);

CREATE TABLE error_log
(
  log_id SERIAL PRIMARY KEY NOT NULL,
  log_level VARCHAR(20) NOT NULL,
  message VARCHAR(1000) NOT NULL
);
CREATE UNIQUE INDEX error_log_log_id_uindex ON error_log (log_id);