#!/usr/bin/env python3


#############################################
#                                           #
#  IMPORT                                   #
#                                           #
#############################################

import re
import logging
import emoji
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

# Callback queries
@bot.callback_query_handler(func=lambda call: True)
def callback_handler(call):    
    if is_flooding(call.from_user.id):
        return
            
    # Ignore
    if is_ignore(call.data):
        param = call.data[8:]

        # Inline keyboard
        markup = telebot.types.InlineKeyboardMarkup()

        if (ignore(call.from_user.id, decode_b62(param)) == 1):
            button = telebot.types.InlineKeyboardButton(lang("undo_btn", call.from_user.id), callback_data="/unignore_%s" % param)
            markup.add(button)
            bot.send_message(call.from_user.id, lang('ignore_user_success', call.from_user.id), parse_mode="markdown", reply_markup=markup)
        else:
            button = telebot.types.InlineKeyboardButton(lang("ignore_btn", call.from_user.id), callback_data="/ignore_%s" % param)
            markup.add(button)
            bot.send_message(call.from_user.id, lang('ignore_user_fail', call.from_user.id), parse_mode="markdown", reply_markup=markup)

        bot.answer_callback_query(call.id)
    
    
    # Unignore
    elif is_unignore(call.data):
        param = call.data[10:]

        # Inline keyboard
        markup = telebot.types.InlineKeyboardMarkup()

        if (unignore(call.from_user.id, decode_b62(param)) == 1):
            button = telebot.types.InlineKeyboardButton(lang("undo_btn", call.from_user.id), callback_data="/ignore_%s" % param)
            markup.add(button)
            bot.send_message(call.from_user.id, lang('unignore_user_success', call.from_user.id), parse_mode="markdown", reply_markup=markup)
        else:
            button = telebot.types.InlineKeyboardButton(lang("unignore_btn", call.from_user.id), callback_data="/unignore_%s" % param)
            markup.add(button)
            bot.send_message(call.from_user.id, lang('unignore_user_fail', call.from_user.id), parse_mode="markdown", reply_markup=markup)
        
        bot.answer_callback_query(call.id)


    # Retrieve
    elif is_retrieve(call.data):
        param = call.data[10:]
        m_id = (call.data)[10:].split('_')
    
        if not is_valid_retrieve(param):
            bot.answer_callback_query(call.id, text=lang('retrieve_fail', call.from_user.id), show_alert=True)
            return
    
        try:
            bot.send_message(-int(decode_b62(m_id[1])),
                            lang('findmsg_group', call.from_user.id) % call.from_user.username,
                            reply_to_message_id=int(decode_b62(m_id[0]))
                            )
            bot.answer_callback_query(call.id, text=lang('findmsg_private', call.from_user.id), show_alert=True)
        except Exception:
            bot.answer_callback_query(call.id, text=lang('findmsg_error', call.from_user.id), show_alert=True)


    # Setlang
    elif call.data == "/setlang":
        bot.answer_callback_query(call.id)
        bot.send_message(call.from_user.id, "%s\n%s" % (lang("setlang_start", call.from_user.id), setlang_list), parse_mode="markdown")
    
    
    # Enable
    elif call.data == "/enable":
        if call.from_user.username is None:
            # No username set
            bot.answer_callback_query(call.id, text=lang('warning_no_username', call.from_user.id), show_alert=True)

        elif is_enabled(call.from_user.id):
            # Already enabled
            bot.answer_callback_query(call.id, text=lang('enable_fail', call.from_user.id), show_alert=True)

        else:
            if check_user(call.from_user.id):
                # Present in database, enable alerts and update the username (even if not needed)
                update_user(call.from_user.id, call.from_user.username, new_enabled=True)
            else:
                add_user(call.from_user.id, call.from_user.username, enabled=True)
                
            global enabled_users
            enabled_users += 1
            bot.answer_callback_query(call.id, text=lang('enable_success', call.from_user.id), show_alert=True)
         
            
    # Feedback
    elif call.data == "/feedback":
        bot.answer_callback_query(call.id)
        msg = bot.send_message(call.from_user.id, lang('feedback_start', call.from_user.id), parse_mode="markdown")
        bot.register_next_step_handler(msg, feedback_send)


# Someone left a group, remove from db
@bot.message_handler(func=lambda m: True, content_types=['left_chat_member'])
def user_left(message):
    if message.left_chat_member.username == "TagAlertBot":
        remove_group(message.chat.id)
    else:
        remove_from_group(message.left_chat_member.id, message.chat.id)
    send_log(message)


# Someone joined a group, add to db
@bot.message_handler(content_types=['new_chat_member'])
def user_join(message):
    add_to_group(message.new_chat_member.id, message.chat.id)
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
        markup = telebot.types.InlineKeyboardMarkup(row_width=2)
        enable_btn = telebot.types.InlineKeyboardButton(lang("enable_btn", message.from_user.id), callback_data="/enable")
        lang_btn = telebot.types.InlineKeyboardButton(lang("lang_btn", message.from_user.id), callback_data="/setlang")
        feedback_btn = telebot.types.InlineKeyboardButton(lang("feedback_btn", message.from_user.id), callback_data="/feedback")
        markup.add(enable_btn, lang_btn)
        markup.add(feedback_btn)

        bot.send_message(message.chat.id, lang('help', message.from_user.id), parse_mode="markdown", reply_markup=markup)

    store_info(message)


# Retrieve the message
@bot.message_handler(func=lambda message: is_retrieve(message.text))
def retrieve(message):
    if is_group(message) or is_flooding(message.from_user.id):
        return

    send_log(message, "retrieve")
    
    # m_id[0] -> message id
    # m_id[1] -> chat id
    param = message.text[10:]
    m_id = (message.text)[10:].split('_')

    if not is_valid_retrieve(param):
        bot.reply_to(message, lang("retrieve_fail", message.from_user.id), parse_mode="markdown")
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
@bot.message_handler(func=lambda message: is_ignore(message.text))
def ignore_h(message):
    if is_group(message) or is_flooding(message.from_user.id):
        return

    send_log(message, "ignore")

    param = message.text[8:]    

    if (ignore(message.from_user.id, decode_b62(param)) == 1):
        bot.reply_to(message, lang('ignore_user_success', message.from_user.id))
    else:
        bot.reply_to(message, lang('ignore_user_fail', message.from_user.id))

    store_info(message)


# /ignoreXXXX - Add XXX to ignored list for user
@bot.message_handler(func=lambda message: is_unignore(message.text))
def unignore_h(message):
    if is_group(message) or is_flooding(message.from_user.id):
        return

    send_log(message, "unignore")

    param = message.text[10:]    

    if (unignore(message.from_user.id, decode_b62(param)) == 1):
        bot.reply_to(message, lang('unignore_user_success', message.from_user.id))
    else:
        bot.reply_to(message, lang('unignore_user_fail', message.from_user.id))

    store_info(message)


# /enable: Update (or add new) settings for user in DB enabling alerts
@bot.message_handler(commands=['enable'])
def enablealerts(message):
    if is_flooding(message.from_user.id):
        return
    
    store_info(message)
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

    store_info(message)
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
            
            markup = telebot.types.InlineKeyboardMarkup()
            enable_btn = telebot.types.InlineKeyboardButton(lang("enable_btn", message.from_user.id), callback_data="/enable")
            markup.add(enable_btn)

            bot.send_message(message.chat.id, lang('disable_success', message.from_user.id), parse_mode="markdown", reply_markup=markup)
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


# /statistics: Show some numbers
@bot.message_handler(commands=['statistics'])
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


# /echo
@bot.message_handler(commands=['echo'])
def echo(message):
    if admin_id == message.from_user.id:
        try:
            param = message.text.split(None, 2)
            bot.send_message(admin_id, "==MESSAGE SENT TO %s==\n%s" % (param[1], param[2]))
            bot.send_message(int(param[1]), param[2])
        except Exception as e:
            bot.send_message(admin_id, e)


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

        matched = get_tags(message)

        for user in matched:
            try:
                # Search for `user` in the JSON file and get the ID
                (userid, enabled) = get_by_username(user)
            except ValueError:
                # If username is not present, is not enabled
                enabled = False


            if enabled and is_in_group(userid, message.chat.id) and not is_ignored(userid, message.from_user.id):
                mittente = message.from_user.first_name.replace("_", "\_")
                if message.from_user.username is not None:
                    mittente = "@%s" % message.from_user.username.replace("_", "\_")

                testobase = emoji.emojize(lang('alert_main', userid) % (mittente, message.chat.title.replace("_", "\_")), use_aliases=True)
                if message.chat.username is None:
                    retrieve_button = telebot.types.InlineKeyboardButton(lang("retrieve", userid), callback_data="/retrieve_%s_%s" % (encode_b62(message.message_id), encode_b62(-message.chat.id)))
                else:
                    retrieve_button = telebot.types.InlineKeyboardButton(lang("retrieve", userid), url="telegram.me/%s/%s" % (message.chat.username, message.message_id))


                # Inline keyboard
                markup = telebot.types.InlineKeyboardMarkup()
                ignore_button = telebot.types.InlineKeyboardButton(lang("ignore", userid), callback_data="/ignore_%s" % encode_b62(message.from_user.id))
                markup.add(ignore_button, retrieve_button)
            
            
                if message.content_type == 'text':
                    testo = testobase + message.text.replace("_", "\_")
                    if message.reply_to_message is not None and message.text is not None:
                        testo = "%s\n\n%s" % (testo, emoji.emojize(lang('alert_reply', userid), use_aliases=True))
                        bot.send_message(userid, testo, parse_mode="markdown", reply_markup=markup, disable_web_page_preview="true")
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id)

                    else:
                        bot.send_message(userid, testo, parse_mode="markdown", reply_markup=markup, disable_web_page_preview="true")

                elif message.content_type == 'photo' or message.content_type == 'video':
                    bot.send_message(userid, testobase, parse_mode="markdown", reply_markup=markup, disable_web_page_preview="true")
                    bot.forward_message(userid, message.chat.id, message.message_id)

                    if message.reply_to_message is not None:
                        bot.send_message(userid, emoji.emojize(lang('alert_reply', userid), use_aliases=True), parse_mode="markdown", reply_markup=markup)
                        bot.forward_message(userid, message.chat.id, message.reply_to_message.message_id, disable_web_page_preview="true")

                send_log(message)
    store_info(message)


#############################################
#                                           #
#  POLLING                                  #
#                                           #
#############################################

bot.polling(none_stop=True)
