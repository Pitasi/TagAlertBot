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
        bot.reply_to(message, replies['help'][lang(message.from_user.id)], parse_mode="markdown")
        check_and_add(message.from_user.id, message.from_user.username)
    elif len(param) == 2:
        # m_id[0] -> message id
        # m_id[1] -> chat id
        m_id = param[1].split('_')

        try:
            bot.send_message(int(m_id[1]), replies['findmsg_group'][lang(message.from_user.id)] % message.from_user.username, reply_to_message_id=int(m_id[0]))
            bot.reply_to(message, replies['findmsg_private'][lang(message.from_user.id)])
        except Exception:
            bot.reply_to(message, replies['findmsg_error'][lang(message.from_user.id)], parse_mode="markdown")

    else:
        bot.reply_to(message, replies['start_error'][lang(message.from_user.id)], parse_mode="markdown")


# /enable: Update (or add new) settings for user in DB enabling alerts
@bot.message_handler(commands=['enable'])
def enablealerts(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            # No username set
            bot.send_message(message.chat.id, replies['warning_no_username'][lang(message.from_user.id)])

        else:
            if check_and_add(message.from_user.id, message.from_user.username, "en", True, False):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, None, True, False)
                global enabled_users
                enabled_users += 1

            bot.send_message(message.chat.id, replies["enable_success"][lang(message.from_user.id)], parse_mode="markdown")

    else:
        bot.reply_to(message, replies["warning_group"][lang(message.from_user.id)], parse_mode="markdown")


# /disable: Update (or add new) settings for user in DB disabling alerts
@bot.message_handler(commands=['disable'])
def disablealerts(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            bot.send_message(message.chat.id, replies['warning_no_username'][lang(message.from_user.id)])

        else:
            if check_and_add(message.from_user.id, message.from_user.username, "en", True, False):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, None, False, False)
                global enabled_users
                enabled_users -= 1

            bot.send_message(message.chat.id, replies['disable_success'][lang(message.from_user.id)], parse_mode="markdown")

    else:
        bot.reply_to(message, replies['warning_group'][lang(message.from_user.id)], parse_mode="markdown")


@bot.message_handler(commands=['setlang'])
def setlang(message):
    send_log(message)
    if is_private(message):
        msg = bot.reply_to(message, "%s\n%s" % (replies["setlang_start"][lang(message.from_user.id)], replies["setlang_list"]), parse_mode="markdown")
    else:
        bot.reply_to(message, replies['warning_group'][lang(message.from_user.id)], parse_mode="markdown")


@bot.message_handler(commands=['en', 'it'])
def setlang_update(message):
    send_log(message)
    if is_private(message):
        if message.from_user.username is None:
            bot.send_message(message.chat.id, replies['warning_no_username'][lang(message.from_user.id)])
        else:
            new_lang = message.text[1:3].lower()
            if check_and_add(message.from_user.id, message.from_user.username, new_lang, None, None):
                # Present in database, change his lang
                update_user(message.from_user.id, message.from_user.username, new_lang, None, None)
            bot.send_message(message.chat.id, replies["setlang_success"][lang(message.from_user.id)], parse_mode="markdown")
    else:
        bot.reply_to(message, replies['warning_group'][lang(message.from_user.id)], parse_mode="markdown")


# /donate: Beg for some money (not so useful, though :P)
@bot.message_handler(commands=['dona', 'donate'])
def dona(message):
    send_log(message)

    if is_private(message):
        bot.send_message(message.chat.id, replies["donate"][lang(message.from_user.id)], parse_mode="markdown", disable_web_page_preview="true")
    else:
        bot.reply_to(message, replies["donate"][lang(message.from_user.id)], parse_mode="markdown", disable_web_page_preview="true")

    check_and_add(message.from_user.id, message.from_user.username)


# /feedback or /report: Share the email address so users can contact owner
@bot.message_handler(commands=['feedback', 'report'])
def feedback(message):
    send_log(message)
    if is_group(message):
        bot.reply_to(message, replies["warning_group"][lang(message.from_user.id)], parse_mode="markdown")
    else:
        msg = bot.reply_to(message, replies["feedback_start"][lang(message.from_user.id)], parse_mode="markdown")
        bot.register_next_step_handler(msg, feedback_send)
    
   
def feedback_send(message):
    if message.text.lower() == "/cancel" or message.text.lower() == "/cancel@tagalertbot":
        send_log(message)
        bot.reply_to(message, replies["feedback_cancel"][lang(message.from_user.id)], parse_mode="markdown")

    elif message.text[0] == '/':
        pass

    else:
        send_feedback(message)
        bot.reply_to(message, replies["feedback_success"][lang(message.from_user.id)], parse_mode="markdown")


# /stats: Show some numbers
@bot.message_handler(commands=['stats', 'statistics'])
def stats(message):
    send_log(message)
    bot.reply_to(message, replies["stats"][lang(message.from_user.id)] % (known_users, enabled_users), parse_mode="markdown")
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
                log_bot.send_message(admin_id, replies["banned_success"][lang(message.from_user.id)] % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, replies["too_many_args"][lang(message.from_user.id)])


# /unban: For admin only, ability to unabn by ID
@bot.message_handler(commands=['unban'])
def unbanhammer(message):
    if admin_id == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_and_add(message.from_user.id, message.from_user.username, None, False, True):
                # Present in database, ban id and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, None, False, True)
                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                log_bot.send_message(admin_id, replies["unbanned_success"][lang(message.from_user.id)] % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, replies["too_many_args"][lang(message.from_user.id)])


# /sourcecode: Show a link for source code on github
@bot.message_handler(commands=['sourcecode'])
def sourcecode(message):
    send_log(message)
    bot.reply_to(message, replies["sourcecode"][lang(message.from_user.id)], parse_mode="markdown")


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

                testobase = replies["alert_main"][lang(userid)] % (mittente, message.chat.title.replace("_", "\_"))
                comando = replies["alert_link"][lang(userid)] % (message.message_id, message.chat.id)

                if message.content_type == 'text':
                    testo = "%s\n%s\n\n%s" % (testobase, message.text.replace("_", "\_"), comando)
                    if message.reply_to_message is not None:
                        testo = "%s\n\n%s" % (replies["alert_reply"][lang(userid)], testo)
                        bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id)

                    else:
                        bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")


                elif message.content_type == 'photo' or message.content_type == 'video':
                    testo = "%s\n\n%s" % (testobase, comando)
                    bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")
                    bot.forward_message(userid, message.chat.id, message.message_id)

                    if message.reply_to_message is not None:
                        bot.send_message(userid, replies["alert_reply"][lang(userid)], parse_mode="markdown")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id, disable_web_page_preview="true")


    check_and_add(message.from_user.id, message.from_user.username)


#############################################
#                                           #
#  POLLING                                  #
#                                           #
#############################################

bot.polling(none_stop=False)
