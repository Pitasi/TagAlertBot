/****************************************************/
//   TagAlertBot (https://t.me/tagalertbot)         //
//   Simple notifications bot for mentions          //
//                                                  //
//   Author: Antonio Pitasi (@Zaphodias)            //
//   2016 - made with love                          //
/****************************************************/

const DEBUG = process.argv[2] == '--dev' || process.env.DEBUG == 'true'

var util = require('util')
var replies = require('./replies.js')
var config = require('./data/config.js')
var AntiFlood = require('./antiflood.js')
var af = new AntiFlood()
var pg = require('pg');
var pool = new pg.Pool(config.pg_pool);
var TelegramBot = require('node-telegram-bot-api')

var bot = new TelegramBot(config.token, {polling: true})

// Send a message to the admin when bot starts
bot.getMe().then((me) => {
  bot.myId = me.id
  bot.sendMessage(config.adminId, util.format(replies.booting, me.username))
})

function removeGroup(groupId) {
  pool.query("DELETE FROM groups WHERE groupId=$1::bigint", [groupId], function (err) {
    console.log("Removing group %s", groupId)
  })
}

function removeUserFromGroup(userId, groupId) {
  pool.query("DELETE FROM groups WHERE userId=? AND groupId=?", [userId, groupId], function (err) {
    console.log("Removing @%s from group %s", userId, groupId)
  })
}

function addUser(username, userId, chatId) {
  if (!username || !userId) return
  var loweredUsername = username.toLowerCase()
  pool.query("INSERT INTO users VALUES ($1, $2)", [userId, loweredUsername], function (err) {
    if (err) pool.query("UPDATE users SET username=$1 WHERE id=$2", [loweredUsername, userId], ()=>{})
    else console.log("Added @%s (%s) to database", loweredUsername, userId)
  })
  if (userId !== chatId)
    pool.query("INSERT INTO groups VALUES ($1, $2)", [chatId, userId], ()=>{})
}

function notifyUser(user, msg, silent) {
  var notify = (userId) => {
    bot.getChatMember(msg.chat.id, userId).then((res) => {
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
        var final_text = util.format(replies.main_caption, from, msg.chat.title, msg.caption)
        var file_id = msg.photo[0].file_id
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
  }

  if (user.substring) { // user is a string -> get id from db
    pool.query("SELECT id FROM users WHERE username=$1", [user.toLowerCase()], function (err, res) {
      console.log('notify', user)
      if (err) return console.error(err)
      if (res && res.rows && res.rows[0] && res.rows[0].id) {
        console.log(user, 'fetched', res.rows[0].id)
        notify(parseInt(res.rows[0].id))
      }
    })
  }
  // user is a number, already the id
  else if (user.toFixed) notify(user)
  else { console.error('Invalid parameters!') }
}

function notifyEveryone(user, groupId, msg) {
  pool.query("SELECT userId FROM groups WHERE groupId=$1 AND userId<>$2", [groupId, user], function (err, res) {
    if (err) return console.error(err)
    for (var i in res.rows) notifyUser(parseInt(res.rows[i].userid), msg, true)
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

bot.on('callback_query', (call) => {
  if (!af.isFlooding(call.from.id)) {
    switch (call.data) {
      case 'admin':
      case 'everyone':
        bot.getChatAdministrators(call.message.chat.id).then((admins) => {
          admins.forEach((admin) => {
            if (call.message.chat.all_members_are_administrators || admin.user.id === call.from.id)
              return updateSettings(call.data, call.message.chat.id, (setting, status) => {
                bot.answerCallbackQuery(
                  call.id, util.format(replies.settings_updated, '#'+setting, status?'enabled':'disabled'), true)
              })

          })
        })
        break
      default:
        var splitted = call.data.split('_')
        if (splitted[0] === '/retrieve') {
          var messageId = splitted[1]
          var groupId = splitted[2]
          bot.sendMessage(-parseInt(groupId),
          util.format(replies.retrieve_group, call.from.username?'@'+call.from.username:call.from.first_name),
          {reply_to_message_id: parseInt(messageId)})
          bot.answerCallbackQuery(call.id, replies.retrieve_success, true)
        }
        break
    }
  }
  else bot.answerCallbackQuery(call.id, replies.flooding, true)
})

bot.onText(/\/start/, (msg) => {
  if (msg.chat.type !== 'private') return

  if (!af.isFlooding(msg.from.id)) {
    bot.sendMessage(msg.chat.id, replies.start_private,
                    {
                      parse_mode: 'HTML',
                      reply_markup: {inline_keyboard: [[{text: replies.add_to_group, url: 't.me/TagAlertBot?startgroup=true'}]]}
                    }
    )
  }
})

bot.onText(/^\/info$|^\/info@TagAlertBot$/gi, (msg) => {
  if (!af.isFlooding(msg.from.id)) {
    if (msg.chat.type !== 'private')
      bot.sendMessage(msg.chat.id, replies.start_group)
    else
      bot.sendMessage(msg.chat.id, replies.start_private, {parse_mode: 'HTML'})
  }
})

bot.onText(/^\/settings(.*)$/gi, (msg) => {
  if (msg.chat.type === 'private') return
  bot.getChatAdministrators(msg.chat.id).then((admins) => {
    admins.forEach((admin) => {
      if (admin.user.id === msg.from.id)
        bot.sendMessage(msg.chat.id, replies.settings, {
          reply_markup: {
            inline_keyboard: [
              [{text: replies.admin_settings, callback_data: 'admin'}],
              [{text: replies.everyone_settings, callback_data: 'everyone'}]
            ]
          }
        })
        return
    })
  })
})

bot.on('message', (msg) => {
  addUser(msg.from.username, msg.from.id, msg.chat.id)

  // A user left the chat
  if (msg.left_chat_member) {
    var userId = msg.left_chat_member.id
    if (userId == bot.myId)
      removeGroup(msg.chat.id)
    else
      removeUserFromGroup(userId, msg.chat.id)
    return
  }

  if (
      (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') ||
      (msg.forward_from && msg.forward_from.id == bot.myId)
    ) return

  var toBeNotified = new Set() // avoid duplicate notifications if tagged twice

  // Text messages
  if (msg.text && msg.entities) {
    // Extract (hash)tags from message text
    var extract = (entity) => {
      return msg.text
                .substring(entity.offset + 1, entity.offset + entity.length)
                .toLowerCase()
    }

    for (var i in msg.entities) {
      var entity = msg.entities[i]

      // Tags
      if (entity.type === 'mention') {
        var username = extract(entity)
        toBeNotified.add(username)
      }

      // Hashtags
      else if (entity.type === 'hashtag') {
        var hashtag = extract(entity)
        if (hashtag === 'everyone') {
          getSetting('everyone', msg.chat.id, () => {
              notifyEveryone(msg.from.id, msg.chat.id, msg)
          })
        }
        else if (hashtag === 'admin') {
          getSetting('admin', msg.chat.id, () => {
            bot.getChatAdministrators(msg.chat.id).then((admins) => {
              admins.forEach((admin) => { notifyUser(admin.user.id, msg, false) })
            })
          })
        }
      }

      // Users without username
      else if (entity.user)
        notifyUser(entity.user.id, msg, false)
    }
  }

  // Images/media captions
  else if (msg.caption) {
    var matched = msg.caption.match(/@[a-z0-9]*/gi)
    for (var i in matched) {
      var username = matched[i].trim().substring(1).toLowerCase()
      toBeNotified.add(username)
    }
  }

  else return

  // helpful to check if user is tagging himself
  var isEqual = (u1, u2) => {
    if (u1 && u2) return u1.toLowerCase() === u2.toLowerCase()
    else return false
  }

  // let's really send notifications
  toBeNotified.forEach((username) => {
    // check if user is tagging himself
    if (!isEqual(msg.from.username, username) || DEBUG) {
      notifyUser(username, msg, false)
    }
  })
})
