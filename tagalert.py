##################################################
## TagAlertBot (https://telegram.me/tagalertbot) #
## Simple notifications for mentions             #
##                                               #
## Author: Antonio Pitasi (@Zaphodias)           #
## 2016 - made with love                         #
##################################################

import telebot
import shelve
from config import *

replies = {
    'start_group':      'Contact me in private for more infos and enabling me.',
    'start_private':
'Hello.\n\
You are now enabled to receive notifications from me, \
Just add @TagAlertBot in your groups and I\'ll start working.\n\
When you\'ll get tagged I\'ll send a message to you.\n\n\
Source code: https://github.com/Pitasi/TagAlertBot\n\
 - a bot by @Zaphodias.',
    'options':          'From group: <b>{}</b>\nAvailable operations:',
    'retrieve':         'Find the message',
    'retrieve_group':   'Here is your message, @{}.',
    'retrieve_success': 'Done!\nNow check the group of the message.',
    'no_username':      'Sorry.\nYou need to set an username from Telegram\'s settings before using me.',
    'error':            'Sorry.\nSomething went wrong.'
}
# end configuration

d   = shelve.open(config['db_path'])
bot = telebot.TeleBot(config['token'], threaded=False)
n = bot.get_me()

@bot.callback_query_handler(func=lambda call: call.data[:9] == "/retrieve")
def callback_handler(call):
    m_id = call.data[10:].split('_')
    try:
        bot.send_message(-int(m_id[1]),
                        replies['retrieve_group'].format(call.from_user.username),
                        reply_to_message_id=int(m_id[0]))
        bot.answer_callback_query(call.id, text=replies['retrieve_success'], show_alert=True)
    except Exception as e:
        print("Exception during callback: {}".format(e))
        try:
            bot.answer_callback_query(call.id, text=replies['error'], show_alert=True)
        except Exception: pass

@bot.message_handler(commands=['help', 'start'])
def help_handler(m):
    if not m.from_user.username:
        try: bot.reply_to(m, replies['no_username'])
        except Exception: pass

        return

    d[m.from_user.username.lower()] = m.from_user.id
    d.sync()
    is_group = m.chat.type == 'group' or m.chat.type == 'supergroup'
    try:
        bot.reply_to(m, replies['start_group'] if is_group else replies['start_private'])
    except Exception as e:
        print("Exception during help handler: {}".format(e))

@bot.message_handler(func=lambda m:                           \
                                m.entities and                  \
                                (m.chat.type == 'group' or      \
                                 m.chat.type == 'supergroup')   )
def main_handler(m):
    markup = telebot.types.InlineKeyboardMarkup()
    if m.chat.username:
        btn = telebot.types.InlineKeyboardButton(replies['retrieve'], url="telegram.me/{}/{}".format(m.chat.username, m.message_id))
    else:
        btn = telebot.types.InlineKeyboardButton(replies['retrieve'], callback_data="/retrieve_{}_{}".format(m.message_id, -m.chat.id))
    markup.add(btn)

    mentioned_users = set()
    for k in m.entities:
        if k.type == 'mention':
            username = m.text[k.offset + 1 : k.offset + k.length].lower()
            user_id = d[username] if username in d else None
            if user_id:
                try:
                    status = bot.get_chat_member(m.chat.id, user_id).status
                    if status != 'left' and status != 'kicked':
                        mentioned_users.add((user_id, username))
                except Exception: return
    for (user_id, username) in mentioned_users:
        try:
          bot.forward_message(user_id, m.chat.id, m.message_id)
          bot.send_message(user_id,
                           replies['options'].format(m.chat.title),
                           reply_markup=markup,
                           parse_mode='HTML')
        except telebot.apihelper.ApiException as e:
          if e.result.status_code == 403:
            print("Removing {} ({}) from database".format(username, user_id))
            try:
                del d[username]
                d.sync()
            except KeyError: pass
          else:
            print("Exception during main handler: {}".format(e))

print('Bot started:\n{}'.format(n))
bot.polling(none_stop=True)
