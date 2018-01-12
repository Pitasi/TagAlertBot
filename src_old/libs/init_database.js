// This file is meant to create the database file for TagAlertBot

var sqlite3 = require('sqlite3')
var config = require('./config.old.js')
var db = new sqlite3.Database(config.dbPath)

db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(256), UNIQUE (id, username))")
db.run("CREATE TABLE groups (groupId INTEGER, userId INTEGER, PRIMARY KEY (groupId, userId))")
db.run("CREATE TABLE groupSettings (groupId INTEGER, everyone INTEGER, admin INTEGER, PRIMARY KEY (groupId))")

console.log('Script ended.')
