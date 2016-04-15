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
from db_aux import *

from boot import *

#############################################
#                                           #
#  HANDLERS                                 #
#                                           #
#############################################

# Someone left a group, remove from db
@bot.message_handler(content_types=['left_chat_participant'])
def user_left(message):
    if message.left_chat_participant.username == "TagAlertBot":
        remove_group(message.chat.id)
    else:
        remove_from_group(message.left_chat_participant.id, message.chat.id)
    send_log(message)


# Someone joined a group, add to db
@bot.message_handler(content_types=['new_chat_participant'])
def user_join(message):
    add_to_group(message.new_chat_participant.id, message.chat.id)
    send_log(message)


# Handle messages from banned users, doing...nothing
@bot.message_handler(func=lambda message: is_banned(message.from_user.id))
def skip_messages(message):
    pass


# /start or /help: Explain bot's features and add user if not present in DB
@bot.message_handler(commands=['start', 'help'])
def help(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, "help")
    if is_group(message):
        bot.reply_to(message, lang('help_group', message.from_user.id), parse_mode="markdown")
    else:
        bot.send_message(message.chat.id, lang('help', message.from_user.id), parse_mode="markdown")

    store_info(message)


# /retrieveXXXX: Retrieve the message
@bot.message_handler(func=lambda message: is_retrieve(message))
def retrieve(message):
    if is_group(message) or is_flooding(message.from_user.id):
        return

    send_log(message, "retrieve")
    
    # m_id[0] -> message id
    # m_id[1] -> chat id
    param = message.text[10:]
    m_id = (message.text)[10:].split('_')

    if not is_valid_retrieve(param):
        bot.reply_to(message, "Sorry, you already retrieved this message too many times.")
        return

    try:
        bot.send_message(-int(decode_b62(m_id[1])),
                         lang('findmsg_group', message.from_user.id) % message.from_user.username,
                         reply_to_message_id=int(decode_b62(m_id[0]))
                        )
        bot.reply_to(message, lang('findmsg_private', message.from_user.id))
    except Exception:
        bot.reply_to(message, lang('findmsg_error', message.from_user.id), parse_mode="markdown")

    store_info(message)


# /ignoreXXXX - Add XXX to ignored list for user
@bot.message_handler(func=lambda message: is_ignore(message))
def ignore_h(message):
    if is_group(message) or is_flooding(message.from_user.id):
        return

    send_log(message, "ignore")

    param = message.text[8:]    

    if (ignore(message.from_user.id, decode_b62(param)) == 1):
        bot.reply_to(message, lang('ignore_user_success', message.from_user.id)  % param, parse_mode="markdown")
    else:
        bot.reply_to(message, lang('ignore_user_fail', message.from_user.id) % param, parse_mode="markdown")

    store_info(message)


# /unignoreXXXX - Add XXX to ignored list for user
@bot.message_handler(func=lambda message: is_unignore(message))
def unignore_h(message):
    if is_group(message) or is_flooding(message.from_user.id):
        return

    send_log(message, "unignore")

    param = message.text[10:]    

    if (unignore(message.from_user.id, decode_b62(param)) == 1):
        bot.reply_to(message, lang('unignore_user_success', message.from_user.id) % param, parse_mode="markdown")
    else:
        bot.reply_to(message, lang('unignore_user_fail', message.from_user.id) % param, parse_mode="markdown")

    store_info(message)


# /enable: Update (or add new) settings for user in DB enabling alerts
@bot.message_handler(commands=['enable'])
def enablealerts(message):
    if is_flooding(message.from_user.id):
        return

    send_log(message, "enable")
    if is_private(message):
        if message.from_user.username is None:
            # No username set
            bot.send_message(message.chat.id, lang('warning_no_username', message.from_user.id))

        elif is_enabled(message.from_user.id):
            # Already enabled
            bot.send_message(message.chat.id, lang('enable_fail', message.from_user.id))

        else:
            if check_user(message.from_user.id):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, new_enabled=True)
            else:
                add_user(message.from_user.id, message.from_user.username, enabled=True)
                
            global enabled_users
            enabled_users += 1
            bot.send_message(message.chat.id, lang('enable_success', message.from_user.id), parse_mode="markdown")

    else:
        bot.reply_to(message, lang('warning_group', message.from_user.id), parse_mode="markdown")

  
# /disable: Update (or add new) settings for user in DB disabling alerts
@bot.message_handler(commands=['disable'])
def disablealerts(message):
    if is_flooding(message.from_user.id):
        return

    send_log(message, "disable")
    if is_private(message):
        if message.from_user.username is None:
            bot.send_message(message.chat.id, lang('warning_no_username', message.from_user.id))

        elif not is_enabled(message.from_user.id):
            # Already disabled
            bot.send_message(message.chat.id, lang('disable_fail', message.from_user.id))

        else:
            if check_user(message.from_user.id):
                # Present in database, disable alerts and update the username (even if not needed)
                update_user(message.from_user.id, message.from_user.username, new_enabled=False)
            else:
                add_user(message.from_user.id, message.from_user.username, enabled=False)
                
            global enabled_users
            enabled_users -= 1
            bot.send_message(message.chat.id, lang('disable_success', message.from_user.id), parse_mode="markdown")
    else:
        bot.reply_to(message, lang('warning_group', message.from_user.id), parse_mode="markdown")


@bot.message_handler(commands=['setlang'])
def setlang(message):
    if is_flooding(message.from_user.id):
        return

    send_log(message, "setlang")
    if is_private(message):
        msg = bot.reply_to(message, "%s\n%s" % (lang("setlang_start", message.from_user.id), setlang_list), parse_mode="markdown")
    else:
        bot.reply_to(message, lang('warning_group', message.from_user.id), parse_mode="markdown")


@bot.message_handler(commands=lang_list)
def setlang_update(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, "change language")
    if is_private(message):
        if message.from_user.username is None:
            bot.send_message(message.chat.id, lang('warning_no_username', message.from_user.id))
        else:
            new_lang = message.text[1:3].lower()
            if check_user(message.from_user.id):
                # Present in database, change his lang
                update_user(message.from_user.id, message.from_user.username, new_lang)
            else:
                # Not present in database, add him
                add_user(message.from_user.id, message.from_user.username, lang=new_lang)

            bot.send_message(message.chat.id, lang('setlang_success', message.from_user.id), parse_mode="markdown")
    else:
        bot.reply_to(message, lang('warning_group', message.from_user.id), parse_mode="markdown")


# /donate: Beg for some money (not so useful, though :P)
@bot.message_handler(commands=['dona', 'donate'])
def dona(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, "donate")

    if is_private(message):
        bot.send_message(message.chat.id, lang('donate', message.from_user.id), parse_mode="markdown", disable_web_page_preview="true")
    else:
        bot.reply_to(message, lang('donate', message.from_user.id), parse_mode="markdown", disable_web_page_preview="true")

    store_info(message)



#/credits: Let's thanks someone
@bot.message_handler(commands=['credits'])
def credits(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, 'credits')
    
    msg = "Bot created by @Zaphodias.\nThanks to @Pilota for helping the bot become more popular.\n\nTranslators:\n*Arabic*: @MRVMVX.\n*Spanish*: @giosann and @imiguelacuna.\n*German*: @F63NNKJ4.\n\nJoin @zaphodiasgroup to get help."

    if is_private(message):
        bot.send_message(message.chat.id, msg, parse_mode="markdown")
    else:
        bot.reply_to(message, msg, parse_mode="markdown")


# /feedback or /report: Share the email address so users can contact owner
@bot.message_handler(commands=['feedback', 'report'])
def feedback(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, "feedback")
    if is_group(message):
        bot.reply_to(message, lang('warning_group', message.from_user.id), parse_mode="markdown")
    else:
        msg = bot.reply_to(message, lang('feedback_start', message.from_user.id), parse_mode="markdown")
        bot.register_next_step_handler(msg, feedback_send)
    
   
def feedback_send(message):
    if is_flooding(message.from_user.id):
        return
    if message.text.lower() == "/cancel" or message.text.lower() == "/cancel@tagalertbot":
        send_log(message, "cancel")
        bot.reply_to(message, lang('feedback_cancel', message.from_user.id), parse_mode="markdown")

    elif message.text[0] == '/':
        pass

    else:
        send_feedback(message)
        bot.reply_to(message, lang('feedback_success', message.from_user.id), parse_mode="markdown")


# /groups: Show the list of groups in which user is known
@bot.message_handler(commands=['groups'])
def get_group_list(message):
    if is_flooding(message.from_user.id):
        return

    send_log(message, "groups")

    if is_group(message):
        bot.reply_to(message, lang('warning_group', message.from_user.id), parse_mode="markdown")
    else:
        ls = ""
        for g in groups_list(message.from_user.id):
            try:
                ls += "\u2705"+group_name(g)+"\n"
            except Exception:
                pass
        if ls == "":
            bot.reply_to(message, "No groups found!\nMake sure you wrote at least one message in a group with me.")
        else:
            bot.reply_to(message, "Groups list:\n"+ls+"\n\n<i>A group is missing?</i> Make sure you wrote at least one message in that group.", parse_mode="html")

    store_info(message)


# /stats: Show some numbers
@bot.message_handler(commands=['stats', 'statistics'])
def stats(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, "stats")
    bot.reply_to(message, lang('stats', message.from_user.id) % (known_users, enabled_users), parse_mode="markdown")
    store_info(message)


# /ban: For admin only, ability to ban by ID
@bot.message_handler(commands=['ban'])
def banhammer(message):
    if admin_id == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_user(message.from_user.id):
                # Present in database, ban id and update the username (even if not needed)
                ban_user(int(param[1]))
                
                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                bot.send_message(admin_id, "Done!")
                log_bot.send_message(admin_id, lang('banned_success', message.from_user.id) % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, lang('too_many_args', message.from_user.id))


# /unban: For admin only, ability to unabn by ID
@bot.message_handler(commands=['unban'])
def unbanhammer(message):
    if admin_id == message.from_user.id:
        param = message.text.split()
        if len(param) > 1:
            if check_user(message.from_user.id):
                # Present in database, unban id and update the username (even if not needed)
                unban_user(int(param[1]))

                timestamp = strftime("%Y-%m-%d %H:%M:%S")
                bot.send_message(admin_id, "Done!")
                log_bot.send_message(admin_id, lang('unbanned_success', message.from_user.id) % (timestamp, int(param[1])))
        else:
            bot.reply_to(message, lang('too_many_args', message.from_user.id))


# /sourcecode: Show a link for source code on github
@bot.message_handler(commands=['sourcecode'])
def sourcecode(message):
    if is_flooding(message.from_user.id):
        return
    send_log(message, "sourcecode")
    bot.reply_to(message, lang('sourcecode', message.from_user.id), parse_mode="markdown")
    store_info(message)


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
            if is_flooding(message.from_user.id):
                return
            send_log(message, "TAG")

        for user in matched:
            try:
                # Search for `user` in the JSON file and get the ID
                (userid, enabled) = get_by_username(user)
            except ValueError:
                # If username is not present, is not enabled
                enabled = False

            if enabled and is_in_group(userid, message.chat.id)  and not is_ignored(userid, message.from_user.id):
                mittente = message.from_user.first_name.replace("_", "\_")
                if message.from_user.username is not None:
                    mittente = "@%s" % message.from_user.username.replace("_", "\_")

                testobase = lang('alert_main', userid) % (mittente, message.chat.title.replace("_", "\_"))
                comando = lang('alert_link', userid) % (encode_b62(message.message_id), encode_b62(-message.chat.id), encode_b62(message.from_user.id))

                if message.content_type == 'text':
                    testo = "%s\n%s\n\n%s" % (testobase, message.text.replace("_", "\_"), comando)
                    if message.reply_to_message is not None and message.text is not None:
                        testo = "%s\n\n%s" % (testo, lang('alert_reply', userid))
                        bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id)

                    else:
                        bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")


                elif message.content_type == 'photo' or message.content_type == 'video':
                    testo = "%s\n\n%s" % (testobase, comando)
                    bot.send_message(userid, testo, parse_mode="markdown", disable_web_page_preview="true")
                    bot.forward_message(userid, message.chat.id, message.message_id)

                    if message.reply_to_message is not None:
                        bot.send_message(userid, lang('alert_reply', userid), parse_mode="markdown")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id, disable_web_page_preview="true")


    store_info(message)


#############################################
#                                           #
#  POLLING                                  #
#                                           #
#############################################

bot.polling(none_stop=True)
