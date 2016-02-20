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
from time import strftime

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
adminid = 0000000
adminmail = 'your@email.com'
mainbottoken = "yourmainbottoken"
logbottoken = "yourlogbottoken"

#############################################
#                                           #
#  OPENING JSON FILES                       #
#                                           #
#############################################

with open(users_json) as json_file:
    users = json.load(json_file)

# TODO: JSON for banned users
# with open(blacklist_json) as jsf:
#     blacklist = json.load(jsf)


#############################################
#                                           #
#  STARTING THE BOT(s)                      #
#                                           #
#############################################

bot = telebot.TeleBot(mainbottoken)
logbot = telebot.TeleBot(logbottoken)
logbot.send_message(adminid, "[%s]\n@TagAlertBot is starting." % strftime("%Y-%m-%d %H:%M:%S"))


#############################################
#                                           #
#  AUXILIARY FUNCTIONS                      #
#                                           #
#############################################

# Check if message is from group chat
def is_group(message):
    return message.chat.type == "group"


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


# Add user to DB using passed arguments
def add_user(userid, username="place-holder", enabled=False, banned=False):
    # Check if users not alredy present
    if not check_user(userid):
        # Add user
        users[str(userid)] = {
            "username": username,
            "enabled": enabled,
            "banned": banned
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
def check_and_add(userid, username="place-holder", enabled=False, banned=False):
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
            return int(r), users[r]['enabled']

    # If cicle didn't return username is not present
    raise ValueError("Unknown username.")


# Send a simple log message to `adminid` using the log bot
def send_log(message):
    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    groupinfo = ""
    if is_group(message):
        groupinfo = "nel gruppo %s (%s)" % (message.chat.title, message.chat.id)
    testo = "[%s]\n@%s\n(%s %s - %s)\n\n%s\n\n%s" % (timestamp, message.from_user.username,
                                                     message.from_user.first_name, message.from_user.last_name,
                                                     message.from_user.id, message.text, groupinfo)
    logbot.send_message(adminid, testo)


#############################################
#                                           #
#  HANDLERS                                 #
#                                           #
#############################################

# Handle messages from banned users doing...nothing
@bot.message_handler(func=lambda message: is_banned(message.from_user.id))
def banhandle(message):
    pass


# Greetings for new chat participant (in groups) if not present in DB
@bot.message_handler(content_types=['new_chat_participant'])
def greetings(message):
    if not check_and_add(message.new_chat_participant.id, message.new_chat_participant.username):
        timestamp = strftime("%Y-%m-%d %H:%M:%S")
        logbot.send_message(adminid, "[%s]\n@%s\n(%s %s - %s) è stato aggiunto a %s"
                            % (timestamp,
                               message.new_chat_participant.username,
                               message.new_chat_participant.first_name,
                               message.new_chat_participant.last_name,
                               message.new_chat_participant.id,
                               message.chat.title))
        name = message.new_chat_participant.first_name
        if message.new_chat_participant.username is not None:
            name = "@%s" % message.new_chat_participant.username
        bot.reply_to(message,
                     "Hi there %s!\nI am TagAlertBot, at your service.\nType /help to know something more about me!"
                     % name)


# /start or /help: Explain bot's features and add user if not present in DB
@bot.message_handler(commands=['start', 'help'])
def helpmessage(message):
    send_log(message)
    testo = "Hi there! I'm *TagAlertBot*, and I'm here to help you!\n\nWith me, you will never lose important messages inside your favorite groups again.\nWhen someone tags you using your @username, I will notify you with a private message.\n\nYou can enable this feature sending /enable to me, *privately*.\n\nPlease report bugs or suggestions using /feedback."

    bot.reply_to(message, testo, parse_mode="markdown")
    check_and_add(message.from_user.id, message.from_user.username)


# /enable: Update (or add new) settings for user in DB enabling alerts
@bot.message_handler(commands=['enable'])
def enablealerts(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            # No username set
            bot.send_message(message.chat.id,
                             "_I'm sorry_.\nYou need to to set an username from Telegram's settings before using this command.")

        else:
            if check_and_add(message.from_user.id, message.from_user.username, True, False):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, True, False)

            bot.send_message(message.chat.id,
                             "Alerts successfully *enabled*.\nFeel free to leave a /feedback sharing your experience.",
                             parse_mode="markdown")

    else:
        bot.reply_to(message, "*Warning:* this command works only in private chat!", parse_mode="markdown")


# /disable: Update (or add new) settings for user in DB disabling alerts
@bot.message_handler(commands=['disable'])
def disablealerts(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            bot.send_message(message.chat.id,
                             "_I'm sorry_.\nYou need to to set an username from Telegram's settings before using this command.")

        else:
            if check_and_add(message.from_user.id, message.from_user.username, True, False):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, True, False)

            bot.send_message(message.chat.id,
                             "Alerts succesfully *disabled*.\nTake a second to give me a /feedback of your experience with the bot.\nRemind that you can _re-enable_ notifications anytime with /enable.",
                             parse_mode="markdown")

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


# /r: Search the message by id in group and reply to it.
@bot.message_handler(commands=['r'])
def getmessage(message):
    send_log(message)
    if is_group(message):
        param = message.text.split()
        if len(param) > 1:
            try:
                bot.send_message(message.chat.id, "Here is your message, @%s." % message.from_user.username,
                                 reply_to_message_id=int(param[1]))
            except ValueError:
                bot.reply_to(message,
                             "_I'm sorry_.\nYou need to provide me the *numeric ID* of the message you are looking for.",
                             parse_mode="markdown")
            except Exception:
                bot.reply_to(message,
                             "_I'm sorry_.\nError(s) occurred searching the message.\nCheck the *ID* and the *group* of message you are looking for.\n\nIf you think this is a mistake /feedback me.",
                             parse_mode="markdown")

        else:
            bot.reply_to(message, "I need the message ID.")
    else:
        bot.send_message(message.chat.id, "This command can work only in the group of the message.")

    check_and_add(message.from_user.id, message.from_user.username)


# /feedback or /report: Share the email address so users can contact owner
@bot.message_handler(commands=['feedback', 'report'])
def feedback(message):
    send_log(message)
    testo = "Hey! If you find a bug, have some awesome ideas, or just want to share your experience with the bot, contact me at %s.\nI will do my best to improve the user experience!" % adminmail
    bot.reply_to(message, testo, parse_mode="markdown")
    check_and_add(message.from_user.id, message.from_user.username)


# /ban: For admin only, ability to ban by ID
@bot.message_handler(commands=['ban'])
def banhammer(message):
    if adminid == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_and_add(message.from_user.id, message.from_user.username, False, True):
                # Present in database, ban id and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, False, True)
                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                logbot.send_message(adminid, "[%s]\nUser %s has been banned." % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, "Parametro non valido")


# /unban: For admin only, ability to unabn by ID
@bot.message_handler(commands=['unban'])
def unbanhammer(message):
    if adminid == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_and_add(message.from_user.id, message.from_user.username, False, True):
                # Present in database, ban id and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, False, True)
                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                logbot.send_message(adminid, "[%s]\nUser %s has been unbanned." % (timestamp, int(param[1])))
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

                testobase = "Howdy!\n@%s _mentioned you in this message from_ *%s*:" \
                            % (mittente,
                               message.chat.title.replace("_", "\_"))
                comando = "To view this message in its context, send the following command in that group:\n/r %s" \
                          % message.message_id

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

    elif message.chat.type == "private":
        bot.send_message(message.chat.id, "*Error!*\nCommand not recognized.\nType /help to find out more.",
                         parse_mode="markdown")

    check_and_add(message.from_user.id, message.from_user.username)


#############################################
#                                           #
#  POLLING                                  #
#                                           #
#############################################

bot.polling(none_stop=False)
