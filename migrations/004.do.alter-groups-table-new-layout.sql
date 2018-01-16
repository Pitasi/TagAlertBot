CREATE TABLE groups_users_users (
  groupId INTEGER NOT NULL,
  userId       INTEGER NOT NULL,
  PRIMARY KEY (groupId, userId)
);

ALTER TABLE groups
  DROP userid;
CREATE UNIQUE INDEX groups_groupid_uindex ON groups (groupid);
ALTER TABLE groups
  ADD title CHARACTER VARYING;
ALTER TABLE groups
  ADD type CHARACTER VARYING;
ALTER TABLE groups
  ADD allmembersadmin BOOLEAN;
ALTER TABLE users
  ALTER COLUMN username TYPE CHARACTER VARYING;
ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;
ALTER TABLE groups_users_users
  ADD CONSTRAINT fk_group_id FOREIGN KEY (groupId) REFERENCES groups (groupid);
ALTER TABLE groups_users_users
  ADD CONSTRAINT fk_user_id FOREIGN KEY (userId) REFERENCES users (id);