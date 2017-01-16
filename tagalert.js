/****************************************************/
//   TagAlertBot (https://telegram.me/tagalertbot)  //
//   Simple notifications for mentions              //
//                                                  //
//   Author: Antonio Pitasi (@Zaphodias)            //
//   2016 - made with love                          //
/****************************************************/

const DEBUG = process.argv[2] == '--dev'

var util = require('util')
var replies = require('./replies.js')
var config = require('./config.js')
var AntiFlood = require('./antiflood.js')
var sqlite3 = require('sqlite3')
var af = new AntiFlood()
var db = new sqlite3.Database(config.dbPath)
var TelegramBot = require('node-telegram-bot-api')

var bot = new TelegramBot(config.token, {polling: {timeout: 1, interval: 1000}})

// Send a message to the admin when bot starts
bot.getMe().then((me) => {
  bot.myId = me.id
  bot.sendMessage(config.adminId, util.format(replies.booting, me.username))
})

function removeGroup(groupId) {
  db.run("DELETE FROM groups WHERE groupId=?", groupId, (err) => {
    if (err) return
    console.log("Removing group %s", groupId)
  })
}

function removeUserFromGroup(userId, groupId) {
  db.run("DELETE FROM groups WHERE userId=? AND groupId=?", userId, groupId, (err) => {
    if (err) return
    console.log("Removing @%s from group %s", userId, groupId)
  })
}

function addUser(username, userId, chatId) {
  if (!username || !userId) return

  var loweredUsername = username.toLowerCase()
  db.run("INSERT INTO users VALUES (?, ?, ?, ?)", userId, loweredUsername, + new Date(), 0, (err, res) => {
    if (err) {
      // User already in db, updating him
      db.run("UPDATE users SET username=? WHERE id=?", loweredUsername, userId, (err, res) => {})
    }
    else
      console.log("Added @%s (%s) to database", loweredUsername, userId)
  })

  if (userId !== chatId)
    db.run("INSERT INTO groups VALUES (?, ?)", chatId, userId, (err) => {})
}

function notifyUser(user, msg) {
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
           .then(()=>{}, ()=>{})
      }
      else {
        var final_text = util.format(replies.main_text, from, msg.chat.title, msg.text)
        bot.sendMessage(userId,
                        final_text,
                        {parse_mode: 'HTML',
                         reply_markup: btn})
           .then(()=>{}, ()=>{}) // avoid logs
      }
    })
  }

  if (user.substring) { // user is a string -> get id from db
    db.each("SELECT id FROM users WHERE username=?", user.toLowerCase(), (err, row) => {
      if (err) return
      notify(row.id)
    })
  }
  // user is a number, already the id
  else if (user.toFixed) notify(user)
}

function notifyEveryone(userId, groupId, msg) {
  db.each("SELECT userId FROM groups WHERE groupId=? AND userId!=?", groupId, userId, (err, row) => {
    if (err) return
    notifyUser(row.userId, msg)
  })
}

bot.on('callback_query', (call) => {
  if (!af.isFlooding(call.from.id)) {
    var splitted = call.data.split('_')
    if (splitted[0] === '/retrieve') {
      var messageId = splitted[1]
      var groupId = splitted[2]
      bot.sendMessage(-parseInt(groupId),
                      util.format(replies.retrieve_group, call.from.username?'@'+call.from.username:call.from.first_name),
                      {reply_to_message_id: parseInt(messageId)})
      bot.answerCallbackQuery(call.id, replies.retrieve_success, false)
    }
  }
  else bot.answerCallbackQuery(call.id, replies.flooding, false)
})

bot.onText(/\/start/, (msg) => {
  if (msg.chat.type !== 'private') return

  if (!af.isFlooding(msg.from.id)) {
    bot.sendMessage(msg.chat.id, replies.start_private, {parse_mode: 'HTML'})
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
          if (!af.isFlooding(msg.from.id)) notifyEveryone(msg.from.id, msg.chat.id, msg)
        }
        else if (hashtag === 'admin') {
          bot.getChatAdministrators(msg.chat.id).then((admins) => {
            admins.forEach((admin) => { notifyUser(admin.user.id, msg) })
          })
        }
      }

      // Users without username
      else if (entity.user)
        notifyUser(entity.user.id, msg)
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
      notifyUser(username, msg)
    }
  })
})
