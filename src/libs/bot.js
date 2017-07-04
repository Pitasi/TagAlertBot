const DEBUG = process.argv[2] == '--dev' || process.env.DEBUG == 'true'

const util = require('util')
const replies = require('./replies.js')
const config = require('../../config.js')
const AntiFlood = require('./antiflood.js')
const af = new AntiFlood()
const TelegramBot = require('node-telegram-bot-api')
const memoize = require('memoizee')
const db = require('./database.js')
const bot = new TelegramBot(config.token, {polling: true})
// Send a message to the admin when bot starts
require('./ascii.js')()
bot.getMe().then((me) => {
  bot.myId = me.id
  if (config.adminId)
    bot.sendMessage(config.adminId, util.format(replies.booting, me.username))
})

bot.deleteMessage = function (messageId, chatId, form = {}) {
  form.chat_id = chatId;
  form.message_id = messageId;
  return this._request('deleteMessage', { form });
}
bot.cachedGetChatMember = memoize(bot.getChatMember, { promise: true, maxAge: 24*60*60*1000 })

bot.on('callback_query', (call) => {
  if (!af.isFlooding(call.from.id)) {
    switch (call.data) {
      case 'admin':
      case 'everyone':
        bot.getChatAdministrators(call.message.chat.id).then((admins) => {
          admins.forEach((admin) => {
            if (call.message.chat.all_members_are_administrators || admin.user.id === call.from.id)
              return db.updateSettings(call.data, call.message.chat.id, (setting, status) => {
                bot.answerCallbackQuery(
                  call.id, util.format(replies.settings_updated, '#'+setting, status?'enabled':'disabled'), true)
              })

          })
        })
        break

      default:
        let splitted = call.data.split('_')
        switch (splitted[0]) {
          case '/retrieve':
            let messageId = splitted[1]
            let groupId = splitted[2]
            bot.sendMessage(
              -parseInt(groupId),
              util.format(replies.retrieve_group, call.from.username?'@'+call.from.username:call.from.first_name, call.from.id),
              {
                reply_to_message_id: parseInt(messageId),
                reply_markup: {inline_keyboard: [[{text: replies.done, callback_data: `/delete_${call.from.id}`}]]}
              }
            ).then((m) => {
              if (config.msg_timeout < 1) return;
              setTimeout(() => {
                bot.deleteMessage(m.message_id, m.chat.id).then(()=>{}).catch(()=>{})
              }, config.msg_timeout * 1000)
            })
            bot.sendMessage(
              call.from.id,
              replies.retrieve_success + '\n\n' + util.format(replies.retrieve_hashtag, call.from.id),
              { reply_to_message_id: call.message.message_id }
            )
            bot.answerCallbackQuery(call.id, replies.retrieve_success, false)
            break

          case '/delete':
            if (call.from.id === parseInt(splitted[1])) bot.deleteMessage(call.message.message_id, call.message.chat.id)
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
    if (msg.chat.type !== 'private') {
      bot.sendMessage(msg.chat.id, replies.start_group).then((m) => {
        if (config.msg_timeout < 1) return
        setTimeout(() => {
          bot.deleteMessage(m.message_id, m.chat.id)
        }, config.msg_timeout * 1000)
      })
    }
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
  db.addUser(msg.from.username, msg.from.id, msg.chat.id)

  // A user left the chat
  if (msg.left_chat_member) {
    let userId = msg.left_chat_member.id
    if (userId == bot.myId)
      db.removeGroup(msg.chat.id)
    else {
      db.removeUserFromGroup(userId, msg.chat.id)
      bot.cachedGetChatMember.delete(msg.chat.id, msg.from.id) // ensure we remove the cache for this user
    }
    return
  }

  if (
      (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') ||
      (msg.forward_from && msg.forward_from.id == bot.myId)
    ) return

  let toBeNotified = new Set() // avoid duplicate notifications if tagged twice

  // Text messages
  if (msg.text && msg.entities) {
    // Extract (hash)tags from message text
    let extract = (entity) => {
      return msg.text
                .substring(entity.offset + 1, entity.offset + entity.length)
                .toLowerCase()
    }

    for (let i in msg.entities) {
      let entity = msg.entities[i]

      // Tags
      if (entity.type === 'mention') {
        let username = extract(entity)
        toBeNotified.add(username)
      }

      // Hashtags
      else if (entity.type === 'hashtag') {
        let hashtag = extract(entity)
        if (hashtag === 'everyone') {
          db.getSetting('everyone', msg.chat.id, () => {
              db.notifyEveryone(bot, msg.from.id, msg.chat.id, msg)
          })
        }
        else if (hashtag === 'admin') {
          db.getSetting('admin', msg.chat.id, () => {
            bot.getChatAdministrators(msg.chat.id).then((admins) => {
              admins.forEach((admin) => { db.notifyUser(bot, admin.user.id, msg, false) })
            })
          })
        }
      }

      // Users without username
      else if (entity.user)
        db.notifyUser(bot, entity.user.id, msg, false)
    }
  }

  // Images/media captions
  else if (msg.caption) {
    let matched = msg.caption.match(/@[a-z0-9]*/gi)
    for (let i in matched) {
      let username = matched[i].trim().substring(1).toLowerCase()
      toBeNotified.add(username)
    }
  }

  else return

  // helpful to check if user is tagging himself
  let isEqual = (u1, u2) => {
    if (u1 && u2) return u1.toLowerCase() === u2.toLowerCase()
    else return false
  }

  // let's really send notifications
  toBeNotified.forEach((username) => {
    // check if user is tagging himself
    if (!isEqual(msg.from.username, username) || DEBUG) {
      db.notifyUser(bot, username, msg, false)
    }
  })
})
