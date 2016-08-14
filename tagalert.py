##################################################
## TagAlertBot (https://telegram.me/tagalertbot) #
## Simple notifications for mentions             #
##                                               #
## Author: Antonio Pitasi (@Zaphodias)           #
## 2016 - made with love                         #
##################################################

import telebot
import shelve

# Configuration
config = {
    # path to your database file
    'db_path':    './userdb',

    # telegram token (contact @BotFather for getting one)
    'token':      'YOUR TOKEN HERE'
}

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
    'error':            'Sorry.\nSomething went wrong.'
}
# end configuration

d   = shelve.open(config['db_path'])
bot = telebot.TeleBot(config['token'])

@bot.callback_query_handler(func=lambda call: call.data[:9] == "/retrieve")
def callback_handler(call):
    m_id = call.data[10:].split('_')
    try:
        bot.send_message(-int(m_id[1]),
                        replies['retrieve_group'].format(call.from_user.username),
                        reply_to_message_id=int(m_id[0]))
        bot.answer_callback_query(call.id, text=replies['retrieve_success'], show_alert=True)
    except telebot.apihelper.ApiException as e:
        print(e)
        bot.answer_callback_query(call.id, text=replies['error'], show_alert=True)

@bot.message_handler(commands=['start', 'help'])
def help_handler(m):
    d[m.from_user.username.lower()] = m.from_user.id
    d.sync()
    is_group = m.chat.type == 'group' or m.chat.type == 'supergroup'
    bot.reply_to(m, replies['start_group'] if is_group else replies['start_private'])

@bot.message_handler(func = lambda m:                           \
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
            mentioned_users.add(
                m.text[k.offset + 1 : k.offset + k.length].lower())
    for user in mentioned_users:
        tmp = d[user] if user in d else None
        if (tmp):
            bot.forward_message(tmp, m.chat.id, m.message_id)
            try:
              bot.send_message(tmp,
                               replies['options'].format(m.chat.title),
                               reply_markup=markup,
                               parse_mode='HTML')
            except telebot.apihelper.ApiException as e:
              if e.result.status_code == 403:
                  del d[user]
                  d.sync()

print('TagAlertBot is now running...')
bot.polling(none_stop=True)
