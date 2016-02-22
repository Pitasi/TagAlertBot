#!/usr/bin/env python3

#############################################
#                                           #
#  IMPORT                                   #
#                                           #
#############################################

import telebot
import re
import json
import logging
from time import time, strftime


#############################################
#                                           #
#  DEBUG LOGGER TO FILE                     #
#  (uncomment to enable)                    #
#                                           #
#############################################

'''
logpath = '/var/tagalertbot'
logname = 'registro.log'

logFormatter = logging.Formatter("%(asctime)s [%(threadName)-12.12s] [%(levelname)-5.5s]  %(message)s")
logger = telebot.logger
telebot.logger.setLevel(logging.DEBUG)

fileHandler = logging.FileHandler("{0}/{1}".format(logpath, logname))
fileHandler.setFormatter(logFormatter)
logger.addHandler(fileHandler)
'''


#############################################
#                                           #
#  CONFIGURATION                            #
#                                           #
#############################################

users_json = '/PATH/TO/users.json'
# blacklist_json = '/var/tagalertbot/blacklist.json'
admin_id = 0000000
admin_mail = 'your@email.com'
main_bot_token = "your_main_bot_token"
log_bot_token = "your_log_bot_token"
feedback_bot_token = "your_feedback_bot_token"
skip_pending = True # Skip messages arrived when bot were offline


#############################################
#                                           #
#  OPENING JSON FILES                       #
#                                           #
#############################################

with open(users_json) as jsf:
    users = json.load(jsf)

# TODO: JSON for banned users
# with open(blacklist_json) as jsf:
#     blacklist = json.load(jsf)


#############################################
#                                           #
#  STARTING THE BOT(s)                      #
#                                           #
#############################################

# Statistics:
global known_users
known_users = 0
global enabled_users
enabled_users = 0

for r in users:
    if users[r]['enabled'] == 1:
        enabled_users+= 1
    known_users+= 1

bot = telebot.TeleBot(main_bot_token)
bot.skip_pending = skip_pending
log_bot = telebot.TeleBot(log_bot_token)
log_bot.send_message(admin_id, "[%s]\n@TagAlertBot is starting." % strftime("%Y-%m-%d %H:%M:%S"))
feedback_bot = telebot.TeleBot(feedback_bot_token)

#############################################
#                                           #
#  AUXILIARY FUNCTIONS                      #
#                                           #
#############################################

# Check if message is from group chat
def is_group(message):
    return message.chat.type == "group" or message.chat.type == "supergroup"


# Check if message is from private chat
def is_private(message):
    return message.chat.type == "private"


# Check if user is present in DB
def check_user(userid):
    return str(userid) in users


# Check if userid is banned
def is_banned(userid):
    try:
        return users[str(userid)]['banned']
    except KeyError:
        return False


# Check if userid is enabled
def is_enabled(userid):
    try:
        return users[str(userid)]['enabled']
    except KeyError:
        return False


# Check if username is bot (some people may have `bot` in their name...well, not my problem :P)
def is_bot(username):
    if username is None:
        return False
    return username[-3:].lower() == "bot"


# Add user to DB using passed arguments
def add_user(userid, username = "place-holder", enabled = False, banned = False):
    # Check if users not alredy present
    if not check_user(userid):
        log_bot.send_message(admin_id, "[%s]\nAdding user @%s (id: %s) to JSON." % (strftime("%Y-%m-%d %H:%M:%S"), username, userid))
        # Add user
        known_users+= 1
        users[str(userid)] = {
                                "username"  : username,
                                "enabled"   : enabled,
                                "banned"    : banned
                              }

        # Write modifications to file
        with open(users_json, 'w') as jsf:
            json.dump(users, jsf)

    else:
        raise ValueError("Trying to add a known user to JSON file.")


# Update userid row in DB with passed arguments. (If 'None' is passed, value won't be modified)
def update_user(userid, new_username=None, new_enabled=None, new_banned=None):
    # Check if users exists
    if check_user(userid):
        # Update the right fields
        if new_username is not None:
            users[str(userid)]['username'] = new_username.lower()
        if new_enabled is not None:
            users[str(userid)]['enabled'] = new_enabled
        if new_banned is not None:
            users[str(userid)]['banned'] = new_banned

        # Write modifications to file
        with open(users_json, 'w') as jsf:
            json.dump(users, jsf)

    else:
        raise ValueError("Trying to update an unknown user.")


# Check if user is present, and eventually add him to DB. Returns True if already present
def check_and_add(userid, username = "place-holder", enabled = False, banned = False):
    if username is None:
        username = "place-holder"

    try:
        add_user(userid, username, enabled, banned)
        return False
    except ValueError:
        return True


# Get userid and enabled from username. Return them as a couple
def get_by_username(username):
    username = username.lower()

    # Scan every user in JSON file
    # TODO: optimize it
    for r in users:
        if users[r]['username'] == username:
            return (int(r), users[r]['enabled'])

    # If cicle didn't return username is not present
    raise ValueError("Unknown username: %s.", username)


# Send a simple log message to `admin_id` using the log bot
def send_log(message):
    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    groupinfo = ""
    if is_group(message):
        groupinfo = "nel gruppo %s (%s)" % (message.chat.title, message.chat.id)
    testo = "[%s]\n@%s\n(%s %s - %s)\n\n%s\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text, groupinfo)
    log_bot.send_message(admin_id, testo)
    

# Send a simple feedback message to `admin_id` using the feedback bot
def send_feedback(message):
    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    testo = "[%s]\n@%s\n(%s %s - %s)\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text)
    feedback_bot.send_message(admin_id, testo)


#############################################
#                                           #
#  HANDLERS                                 #
#                                           #
#############################################

# Handle too much old (> 5 seconds ago) messages OR from banned users, doing...nothing
@bot.message_handler(func=lambda message: is_banned(message.from_user.id))
def skip_messages(message):
    pass


# Greetings for new chat participant (in groups) if not present in DB
@bot.message_handler(content_types=['new_chat_participant'])
def greetings(message):
    if not check_and_add(message.new_chat_participant.id, message.new_chat_participant.username) and not is_bot(message.new_chat_participant.username):
        timestamp = strftime("%Y-%m-%d %H:%M:%S")
        log_bot.send_message(admin_id, "[%s]\n@%s\n(%s %s - %s) è stato aggiunto a %s" % (timestamp, message.new_chat_participant.username, message.new_chat_participant.first_name, message.new_chat_participant.last_name, message.new_chat_participant.id, message.chat.title))
        name = message.new_chat_participant.first_name
        if message.new_chat_participant.username is not None:
            name = "@%s" % message.new_chat_participant.username
        bot.reply_to(message, "Hi there %s!\nI am TagAlertBot, at your service.\nType /help to know something more about me!" % name)


# /start or /help: Explain bot's features and add user if not present in DB
@bot.message_handler(commands=['start', 'help'])
def help(message):
    param = message.text.split()
    if len(param) == 1:
        send_log(message)
        testo = "Hi there! I'm *TagAlertBot*, and I'm here to help you!\n\nWith me, you will never lose important messages inside your favorite groups again.\nWhen someone tags you using your @username, I will notify you with a private message.\n\nYou can enable this feature sending /enable to me, *privately*.\n\nPlease report bugs or suggestions using /feedback."

        bot.reply_to(message, testo, parse_mode="markdown")
        check_and_add(message.from_user.id, message.from_user.username)
    elif len(param) == 2:
        # m_id[0] -> message id
        # m_id[1] -> chat id
        m_id = param[1].split('_')

        try:
            bot.send_message(int(m_id[1]), "Here is your message, @%s." % message.from_user.username, reply_to_message_id=int(m_id[0]))
        except Exception:
            bot.reply_to(message, "_I'm sorry_.\nError(s) occurred searching the message.\nCheck the *ID* and the *group* of message you are looking for.\n\nIf you think this is a mistake /feedback me.", parse_mode="markdown")

    else:
        bot.reply_to(message, "Error(s) occurred.\nPlease /feedback reporting this.", parse_mode="markdown")


# /enable: Update (or add new) settings for user in DB enabling alerts
@bot.message_handler(commands=['enable'])
def enablealerts(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            # No username set
            bot.send_message(message.chat.id, "_I'm sorry_.\nYou need to to set an username from Telegram's settings before using this command.")

        else:
            if check_and_add(message.from_user.id, message.from_user.username, True, False):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, True, False)
                enabled_users+= 1

            bot.send_message(message.chat.id, "Alerts successfully *enabled*.\nFeel free to leave a /feedback sharing your experience.", parse_mode="markdown")

    else:
        bot.reply_to(message, "*Warning:* this command works only in private chat!", parse_mode="markdown")


# /disable: Update (or add new) settings for user in DB disabling alerts
@bot.message_handler(commands=['disable'])
def disablealerts(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            bot.send_message(message.chat.id, "_I'm sorry_.\nYou need to to set an username from Telegram's settings before using this command.")

        else:
            if check_and_add(message.from_user.id, message.from_user.username, True, False):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, True, False)
                enabled_users-= 1

            bot.send_message(message.chat.id, "Alerts succesfully *disabled*.\nTake a second to give me a /feedback of your experience with the bot.\nRemind that you can _re-enable_ notifications anytime with /enable.", parse_mode="markdown")

    else:
        bot.reply_to(message, "*Warning:* this command works only in private chat!", parse_mode="markdown")


# /donate: Beg for some money (not so useful, though :P)
@bot.message_handler(commands=['dona', 'donate'])
def dona(message):
    send_log(message)

    testo = "You can use me for free.\n\nSadly, even if I am a bot I need to pay bills in _BOTLand_.\nIf you would like to give some help, just click here: http://paypal.me/pitasi.\nThanks!"
    if is_private(message):
        bot.send_message(message.chat.id, testo, parse_mode="markdown", disable_web_page_preview="true")
    else:
        bot.reply_to(message, testo, parse_mode="markdown", disable_web_page_preview="true")

    check_and_add(message.from_user.id, message.from_user.username)


# /feedback or /report: Share the email address so users can contact owner
@bot.message_handler(commands=['feedback', 'report'])
def feedback(message):
    send_log(message)
    if is_group(message):
        bot.reply_to(message, "Please use this command in a private chat with me.", parse_mode="markdown")
    else:
        testo = "Hey! If you find a bug, have some awesome ideas, or just want to share your experience with the bot, you can contact me in seconds.\nJust write your message now (or /cancel to abort):"
        msg = bot.reply_to(message, testo, parse_mode="markdown")
        bot.register_next_step_handler(msg, feedback_send)
    

# /feedback second step function. Read the message, if it is /cancel abort, else send the feedback through the feedbacks bot
def feedback_send(message):
    if message.text.lower() == "/cancel" or message.text.lower() == "/cancel@tagalertbot":
        bot.reply_to(message, "Message deleted.", parse_mode="markdown")
    else:
        send_feedback(message)
        bot.reply_to(message, "Message succesfully sent.\nIf needed, you will be contacted soon, here on Telegram.\nThank you!", parse_mode="markdown")


# /feedback or /report: Share the email address so users can contact owner
@bot.message_handler(commands=['stats', 'statistics'])
def stats(message):
    send_log(message)
    testo = "TagAlertBot usage statistics:\n*Known users*: %s\n*Enabled users:* %s" % (known_users, enabled_users)
    bot.reply_to(message, testo, parse_mode="markdown")
    check_and_add(message.from_user.id, message.from_user.username)


# /ban: For admin only, ability to ban by ID
@bot.message_handler(commands=['ban'])
def banhammer(message):
    if admin_id == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_and_add(message.from_user.id, message.from_user.username, False, True):
                # Present in database, ban id and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, False, True)
                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                log_bot.send_message(admin_id, "[%s]\nUser %s has been banned." % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, "Parametro non valido")


# /unban: For admin only, ability to unabn by ID
@bot.message_handler(commands=['unban'])
def unbanhammer(message):
    if admin_id == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_and_add(message.from_user.id, message.from_user.username, False, True):
                # Present in database, ban id and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, False, True)
                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                log_bot.send_message(admin_id, "[%s]\nUser %s has been unbanned." % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, "Parametro non valido")


# Every text, photo or video. Search for @tags, search every tag in DB and contact the user if alerts are enabled
@bot.message_handler(content_types=['text', 'photo', 'video'])
def aggiornautente(message):
    if is_group(message):
        matched = []

        if message.text is not None:
            matched = list(set(re.findall("@([a-zA-Z0-9_]*)", message.text)))

        if message.caption is not None:
            matched = list(set(re.findall("@([a-zA-Z0-9_]*)", message.caption)))

        if len(matched) > 0:
            send_log(message)

        for user in matched:
            try:
                # Search for `user` in the JSON file and get the ID
                (userid, enabled) = get_by_username(user)
            except ValueError:
                # If username is not present, is not enabled
                enabled = False

            if enabled:
                mittente = message.from_user.first_name.replace("_", "\_")
                if message.from_user.username is not None:
                    mittente = message.from_user.username.replace("_", "\_")

                testobase = "Howdy!\n@%s _mentioned you in this message from_ *%s*:" % (mittente, message.chat.title.replace("_", "\_"))
                comando = "To view this message in its context, just click on the following link:\ntelegram.me/TagAlertBot?start=%s\_%s\nThen click on Start _(down there)_, and open the group of the message." % (message.message_id, message.chat.id)

                if message.content_type == 'text':
                    testo = "%s\n%s\n\n%s" % (testobase, message.text.replace("_", "\_"), comando)
                    if message.reply_to_message is not None:
                        testo = "%s\n\n_replying to:_" % testo
                        bot.send_message(userid, testo, parse_mode="markdown")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id)

                    else:
                        bot.send_message(userid, testo, parse_mode="markdown")


                elif message.content_type == 'photo' or message.content_type == 'video':
                    testo = "%s\n\n%s" % (testobase, comando)
                    bot.send_message(userid, testo, parse_mode="markdown")
                    bot.forward_message(userid, message.chat.id, message.message_id)

                    if message.reply_to_message is not None:
                        bot.send_message(userid, "_replying to_", parse_mode="markdown")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id)


    check_and_add(message.from_user.id, message.from_user.username)


#############################################
#                                           #
#  POLLING                                  #
#                                           #
#############################################

bot.polling(none_stop=False)
