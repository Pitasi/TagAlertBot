#############################################
#                                           #
#  AUXILIARY FUNCTIONS                      #
#                                           #
#############################################

import botan
import six

from config import *
from db_aux import *

from time import time, strftime

import string
from math import floor


# Thanks @Edurolp, useful for Botan analytics
def to_json(m):
    d = {}
    for x, y in six.iteritems(m.__dict__):
        if hasattr(y, '__dict__'):
            d[x] = to_json(y)
        else:
            d[x] = y
    return d
    
    
#############################################
#  Numbers encoding                         #     
#############################################     

# Encode an integer to base 62 (letters+numbers)
def encode_b62(num, b = 62):
    if b <= 0 or b > 62:
        return 0
    base = string.digits + string.ascii_lowercase + string.ascii_uppercase
    r = num % b
    res = base[r];
    q = floor(num / b)
    while q:
        r = q % b
        q = floor(q / b)
        res = base[int(r)] + res
    return res


# Decode a base 62 string to integer
def decode_b62(num, b = 62):
    base = string.digits + string.ascii_lowercase + string.ascii_uppercase
    limit = len(num)
    res = 0
    for i in range(limit):
        res = b * res + base.find(num[i])
    return res


#############################################
#  Messages                                 #     
#############################################     

# Check if message is from group chat
def is_group(message):
    return message.chat.type == "group" or message.chat.type == "supergroup"


# Check if message is from private chat
def is_private(message):
    return message.chat.type == "private"


# Check if username is bot (some people may have `bot` in their name...well, not my problem :P)
def is_bot(username):
    if username is None:
        return False
    return username[-3:].lower() == "bot"


# Check if is a /retrieve command
def is_retrieve(txt):
    try:
        return (txt)[:9] == "/retrieve"
    except Exception:
        return False


# Check if is a /ignore command
def is_ignore(txt):
    try:
        return (txt)[:8] == "/ignore_"
    except Exception:
        return False


# Check if is a /unignore command
def is_unignore(txt):
    try:
        return (txt)[:10] == "/unignore_"
    except Exception:
        return False


# Find the tags inside a message, returns a set
# I <3 Python
def get_tags(message):
    res = set()

    if message.entities is not None:
        for k in message.entities:
            if k.type == 'mention':
                res.add(message.text[k.offset + 1 : k.offset + k.length].lower())

    return res


#############################################
#  Logs and feedbacks bots                  #     
#############################################     

# Send a simple log message to `admin_id` using the log bot
def send_log(message, cmd=None):
    if cmd is not None:
        try:
            botan.track(botan_token, message.from_user.id, to_json(message), cmd)
        except Exception:
            pass

    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    group_info = ""
    text = ""

    if is_group(message):
        group_info = "in group %s (%s)" % (message.chat.title, message.chat.id)
    
    if message.text is not None:
        text = "[%s]\n@%s\n(%s %s - %s)\n\n%s\n\n%s" %\
                (timestamp,
                message.from_user.username,
                message.from_user.first_name,
                message.from_user.last_name,
                message.from_user.id,
                message.text,
                group_info)
    elif message.caption is not None:
        text = "[%s]\n@%s\n(%s %s - %s)\n\n%s\n\n%s" %\
                (timestamp,
                message.from_user.username,
                message.from_user.first_name,
                message.from_user.last_name,
                message.from_user.id,
                message.caption,
                group_info)
    elif message.left_chat_member is not None:
        text = "[%s]\n@%s\n(%s %s - %s)\n\n%s %s (%s)" %\
                (timestamp,
                message.left_chat_member.username,
                message.left_chat_member.first_name,
                message.left_chat_member.last_name,
                message.left_chat_member.id,
                "removed from group",
                message.chat.title,
                message.chat.id)
    elif message.new_chat_member is not None:
        text = "[%s]\n@%s\n(%s %s - %s)\n\n%s %s (%s)" %\
                (timestamp,
                message.new_chat_member.username,
                message.new_chat_member.first_name,
                message.new_chat_member.last_name,
                message.new_chat_member.id,
                "added in group",
                message.chat.title,
                message.chat.id)
                
    log_bot.send_message(admin_id, text)
    

# Send a simple feedback message to `admin_id` using the feedback bot
def send_feedback(message):
    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    text = "[%s]\n@%s\n(%s %s - %s)\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text)
    feedback_bot.send_message(admin_id, text)
