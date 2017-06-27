// 1. Create connection to Postgre
// 2. Create tables if not already present
// 3. Export functions

/* IMPORTS */
const util = require('util')
const replies = require('./replies')
const config = require('../../config.js')
const pg = require('pg')
const pool = new pg.Pool(config.database)

/* CREATE TABLES */
pool.query('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username VARCHAR(256), UNIQUE (id, username))')
pool.query('CREATE TABLE IF NOT EXISTS groups (groupId INTEGER, userId INTEGER, PRIMARY KEY (groupId, userId))')
pool.query('CREATE TABLE IF NOT EXISTS groupSettings (groupId INTEGER, everyone INTEGER, admin INTEGER, PRIMARY KEY (groupId))')
pool.query('CREATE TABLE IF NOT EXISTS actionlog (action VARCHAR(30000) NOT NULL, request VARCHAR(30000), response VARCHAR(30000), time TIMESTAMP DEFAULT current_timestamp)')

/* FUNCTIONS */
function removeGroup(groupId) {
  pool.query("DELETE FROM groups WHERE groupId=$1::bigint", [groupId], function (err) {
    if (err) return console.error(err)
  })
}

function removeUserFromGroup(userId, groupId) {
  pool.query("DELETE FROM groups WHERE userId=? AND groupId=?", [userId, groupId], function (err) {
    if (err) return console.error(err)
  })
}

function addUser(username, userId, chatId) {
  if (!username || !userId) return

  let loweredUsername = username.toLowerCase()
  // Store user or update his username
  pool.query("INSERT INTO users VALUES ($1, $2)", [userId, loweredUsername], function (err) {
    if (err) pool.query("UPDATE users SET username=$1 WHERE id=$2", [loweredUsername, userId], ()=>{})
  })

  // Add user to the group (#everyone command needs that)
  if (userId !== chatId)
    pool.query("INSERT INTO groups VALUES ($1, $2)", [chatId, userId], ()=>{})
}

function notifyUser(bot, user, msg, silent) {
  let notify = (userId) => {
    bot.getChatMember(msg.chat.id, userId)
    .then((res) => {
      db.logAction('getChatMember', {user: user}, res)
      if (res.status == 'left' || res.status == 'kicked') return
      // User is inside in the group
      var from = util.format('%s %s %s',
        msg.from.first_name,
        msg.from.last_name ? msg.from.last_name : '',
        msg.from.username ? `(@${msg.from.username})` : ''
      )
      var btn = {inline_keyboard:[[{text: replies.retrieve}]]}
      if (msg.chat.username)
        btn.inline_keyboard[0][0].url = `telegram.me/${msg.chat.username}/${msg.message_id}`
      else
        btn.inline_keyboard[0][0].callback_data = `/retrieve_${msg.message_id}_${-msg.chat.id}`

      if (msg.photo) {
        let final_text = util.format(replies.main_caption, from, msg.chat.title, msg.caption)
        const file_id = msg.photo[0].file_id
        if (final_text.length > 200) final_text = final_text.substr(0, 197) + '...'
        bot.sendPhoto(userId, file_id, {caption: final_text, reply_markup: btn})
      }
      else {
        var final_text = util.format(replies.main_text, from, msg.chat.title, msg.text)
        bot.sendMessage(userId,
                        final_text,
                        {parse_mode: 'HTML',
                         reply_markup: btn,
			 disable_notification: silent})
      }
    })
    .catch((err) => {
      db.logAction('getChatMember', {user: user}, err)
    })
  }

  if (user.substring) { // user is a string -> get id from db
    pool.query("SELECT id FROM users WHERE username=$1", [user.toLowerCase()], function (err, res) {
      console.log('notify', user)
      if (err) return console.error(err)
      if (res && res.rows && res.rows[0] && res.rows[0].id) {
        notify(parseInt(res.rows[0].id))
      }
    })
  }
  // user is a number, already the id
  else if (user.toFixed) notify(user)
  else { console.error('Invalid parameters!') }
}

function notifyEveryone(bot, user, groupId, msg) {
  pool.query("SELECT userId FROM groups WHERE groupId=$1 AND userId<>$2", [groupId, user], function (err, res) {
    if (err) return console.error(err)
    res.rows.forEach((r) => {notifyUser(bot, parseInt(r.userid), msg, true)})
  })
}

function updateSettings(setting, chatId, callback) {
  pool.query("SELECT * FROM groupSettings WHERE groupId=$1", [chatId], function (err, res) {
    if (err) return console.error(err)
    var row = res.rows[0]
    if (row) {
      // group is present in db
      var newValue = row
      newValue[setting] = 1 - newValue[setting]
      pool.query("UPDATE groupSettings SET admin=$1,everyone=$2 WHERE groupId=$3", [newValue.admin, newValue.everyone, chatId], function () {
        callback(setting, newValue[setting])
      })
    }
    else {
      // group is changing settings for the first time
      var defaultValue = {admin: 1, everyone: 0}
      defaultValue[setting] = 1 - defaultValue[setting]
      pool.query("INSERT INTO groupSettings VALUES ($1,$2,$3)", [chatId, defaultValue.admin, defaultValue.everyone], function () {
        callback(setting, defaultValue[setting])
      })
    }
  })
}

function getSetting(setting, chatId, callback) {
  pool.connect().then(client => {
    var query = client.query("SELECT * FROM groupSettings WHERE groupId=$1", [chatId]);
    query.on('error', (err) => {console.error(err)})
    query.on('row', (row) => {
      if (row) {
        if (row[setting]) callback()
      }
      else {
        var defaultValue = {admin: 1, everyone: 0}
        if (defaultValue[setting]) callback()
      }
    })
    query.on('end', client.release)
  }).catch(e => {
    client.release()
    console.error('query error', e.message, e.stack)
  })
}

function logAction(action, request, response) {
  pool.query("INSERT INTO actionlog (action, request, response) VALUES ($1,$2,$3)", [action, request, response])
}

module.exports = {
  removeGroup: removeGroup,
  removeUserFromGroup: removeUserFromGroup,
  addUser: addUser,
  notifyUser: notifyUser,
  notifyEveryone: notifyEveryone,
  updateSettings: updateSettings,
  getSetting: getSetting,
  logAction: logAction
}
