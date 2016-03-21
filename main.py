#!/usr/bin/env python3

#############################################
#                                           #
#  IMPORT                                   #
#                                           #
#############################################

import re
import logging
from time import time, strftime

from config import *
from aux import *


#############################################
#                                           #
#  DEBUG LOGGER TO FILE                     #
#  (uncomment to enable)                    #
#                                           #
#############################################

if (enable_debug_log):
    logFormatter = logging.Formatter("%(asctime)s [%(threadName)-12.12s] [%(levelname)-5.5s]  %(message)s")
    logger = telebot.logger
    telebot.logger.setLevel(logging.DEBUG)
    fileHandler = logging.FileHandler("{0}/{1}".format(logpath, logname))
    fileHandler.setFormatter(logFormatter)
    logger.addHandler(fileHandler)


#############################################
#                                           #
#  HANDLERS                                 #
#                                           #
#############################################

# Handle messages from banned users, doing...nothing
@bot.message_handler(func=lambda message: is_banned(message.from_user.id))
def skip_messages(message):
    pass


# /start or /help: Explain bot's features and add user if not present in DB
@bot.message_handler(commands=['start', 'help'])
def help(message):
    param = message.text.split()
    send_log(message)
    if len(param) == 1:
        testo = "Hi there! I'm *TagAlertBot*, and I'm here to help you!\n\nWith me, you will never lose important messages inside your favorite groups again.\nWhen someone tags you using your @username, I will notify you with a private message.\n\nYou can enable this feature sending /enable to me, *privately*.\n\nPlease report bugs or suggestions using /feedback."

        bot.reply_to(message, testo, parse_mode="markdown")
        check_and_add(message.from_user.id, message.from_user.username)
    elif len(param) == 2:
        # m_id[0] -> message id
        # m_id[1] -> chat id
        m_id = param[1].split('_')

        try:
            bot.send_message(int(m_id[1]), "Here is your message, @%s." % message.from_user.username, reply_to_message_id=int(m_id[0]))
            bot.reply_to(message, "Done!\nNow check the group of the message.")
        except Exception:
            bot.reply_to(message, "_I'm sorry_.\nError(s) occurred searching the message.\nCheck the *ID* and the *group* of message you are looking for.\n\nIf you think this is a mistake /feedback me.", parse_mode="markdown")

    else:
        bot.reply_to(message, "Unexpected error occurred.\nPlease /feedback reporting this.", parse_mode="markdown")


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
                global enabled_users
                enabled_users += 1

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
                update_user(message.from_user.id, message.from_user.username, False, False)
                global enabled_users
                enabled_users -= 1

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
    
   
def feedback_send(message):
    if message.text.lower() == "/cancel" or message.text.lower() == "/cancel@tagalertbot":
        send_log(message)
        bot.reply_to(message, "Message deleted.", parse_mode="markdown")

    elif message.text[0] == '/':
        pass

    else:
        send_feedback(message)
        bot.reply_to(message, "Message succesfully sent.\nIf needed, you will be contacted soon, here on Telegram.\nThank you!", parse_mode="markdown")


# /stats: Show some numbers
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
                update_user(int(param[1]), None, False, True)
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


# /sourcecode: Show a link for source code on github
@bot.message_handler(commands=['sourcecode'])
def sourcecode(message):
    send_log(message)
    testo = "My source code is *open* and *free*.\nYou can find it here: http://www.github.com/pitasi/TagAlertBot."
    if is_group(message):
        bot.reply_to(message, testo, parse_mode="markdown")
    else:
        bot.send_message(message.chat.id, testo, parse_mode="markdown")


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
                    mittente = "@%s" % message.from_user.username.replace("_", "\_")

                testobase = "Howdy!\n%s _mentioned you in this message from_ *%s*:" % (mittente, message.chat.title.replace("_", "\_"))
                comando = "To view this message in its context, just click on the following link:\ntelegram.me/TagAlertBot?start=%s\_%s\nThen click on Start _(down there)_, and open the group of the message." % (message.message_id, message.chat.id)

                if message.content_type == 'text':
                    testo = "%s\n%s\n\n%s" % (testobase, message.text.replace("_", "\_"), comando)
                    if message.reply_to_message is not None:
                        testo = "%s\n\n_replying to:_" % testo
                        bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id)

                    else:
                        bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")


                elif message.content_type == 'photo' or message.content_type == 'video':
                    testo = "%s\n\n%s" % (testobase, comando)
                    bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")
                    bot.forward_message(userid, message.chat.id, message.message_id)

                    if message.reply_to_message is not None:
                        bot.send_message(userid, "_replying to_", parse_mode="markdown")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id, disable_web_page_preview="true")


    check_and_add(message.from_user.id, message.from_user.username)


#############################################
#                                           #
#  POLLING                                  #
#                                           #
#############################################

bot.polling(none_stop=False)
