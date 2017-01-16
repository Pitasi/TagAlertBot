// This file is meant to create the database file for TagAlertBot

var sqlite3 = require('sqlite3')
var config = require('./config.js')
var db = new sqlite3.Database(config.dbPath)

db.run("CREATE TABLE users (id INTEGER, username VARCHAR(256), PRIMARY KEY (id, username))")
db.run("CREATE TABLE groups (groupId INTEGER, userId INTEGER, PRIMARY KEY (groupId, userId))")

console.log('Script ended.')
