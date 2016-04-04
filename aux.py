#############################################
#                                           #
#  AUXILIARY FUNCTIONS                      #
#                                           #
#############################################

import botan
import six
from config import *
from time import time, strftime


# Thanks @Edurolp, useful for Botan analytics
def to_json(m):
    d = {}
    for x, y in six.iteritems(m.__dict__):
        if hasattr(y, '__dict__'):
            d[x] = to_json(y)
        else:
            d[x] = y
    return d


# Check if is flooding
def is_flooding(userid):             
    tmp = db.get("flood:"+str(userid))

    if tmp is not None and int(tmp) >= 5:
        ban_user(userid)
        try:
            bot.send_message(userid, lang('flooding_banned', userid))
        except Exception:
            pass
        log_bot.send_message(admin_id, "User %s banned for flooding." % userid) 
        return True
   
    ttl = db.ttl("flood:"+str(userid))
    db.incr("flood:"+str(userid))
    if ttl is None:
        ttl = 5
    db.expire("flood:"+str(userid), ttl)
    return False


# Check if message is from group chat
def is_group(message):
    return message.chat.type == "group" or message.chat.type == "supergroup"


# Check if message is from private chat
def is_private(message):
    return message.chat.type == "private"


# Check if user is present in DB
def check_user(userid):
    return db.exists(str(userid))


# Check if userid is banned
def is_banned(userid):
    return db.sismember("banned", str(userid))


# Check if userid1 is ignoring userid2
def is_ignored(userid1, userid2):
    return db.sismember("ignore:"+str(userid1), userid2)


# Check if userid is enabled
def is_enabled(userid):
    return db.hget(str(userid), "enabled") == "True"


# Check if username is bot (some people may have `bot` in their name...well, not my problem :P)
def is_bot(username):
    if username is None:
        return False
    return username[-3:].lower() == "bot"


# Check if is a /retrieve command
def is_retrieve(message):
    try:
        return (message.text)[:9] == "/retrieve"
    except Exception:
        return False


# Check if is a /ignore command
def is_ignore(message):
    try:
        return (message.text)[:7] == "/ignore"
    except Exception:
        return False


# Check if is a /unignore command
def is_unignore(message):
    try:
        return (message.text)[:9] == "/unignore"
    except Exception:
        return False


# Ban by userid
def ban_user(userid):
    return db.sadd("banned", userid)


# Unban by userid
def unban_user(userid):
    return db.srem("banned", userid)


# Add userid2 to ignored list of userid1
def ignore(userid1, userid2):
    return db.sadd("ignore:"+str(userid1), userid2)


# Remove userid2 from ignored list of userid1
def unignore(userid1, userid2):
    return db.srem("ignore:"+str(userid1), userid2)


# Get string localized, or english
def lang(code, userid):
    l = db.hget(str(userid), "lang")
    try:
        return replies[l][code]
    except KeyError:
        return replies['en'][code]


# Add user to DB using passed arguments
def add_user(userid, username = "place-holder", lang = "en", enabled = False):
    # Check if users not alredy present
    if not check_user(userid):
        log_bot.send_message(admin_id, "[%s]\nAdding user @%s (id: %s) to database." % (strftime("%Y-%m-%d %H:%M:%S"), username, userid))
        # Add user
        global known_users
        known_users += 1
        
        db.hset(str(userid), "username", username.lower())
        db.hset(str(userid), "lang", lang)
        db.hset(str(userid), "enabled", enabled)       

    else:
        raise ValueError("Trying to add a known user to database.")


# Update userid row in DB with passed arguments. (If 'None' is passed, value won't be modified)
def update_user(userid, new_username=None, new_lang=None, new_enabled=None):
    # Check if users exists
    if check_user(userid):
        # Update the right fields
        if new_username is not None:
            db.hset(str(userid), "username", new_username.lower())
        if new_lang is not None:
            db.hset(str(userid), "lang", new_lang)
        if new_enabled is not None:
            db.hset(str(userid), "enabled", new_enabled)

    else:
        log_bot.send_message(adminid, "Trying to update an unknown user: %s." % userid)
        raise ValueError("Trying to update an unknown user.")


# Check if user is present, and eventually add him to DB. Returns True if already present
def check_and_add(userid, username = "place-holder", lang = "en", enabled = False):
    if username is not None:
        try:
            add_user(userid, username=username, lang=lang, enabled=enabled)
            return False
        except ValueError:
            return True


# Get userid and enabled from username. Return them as a couple
def get_by_username(username):
    username = username.lower()

    # TODO: optimize it
    for k in db.scan_iter():
        try:
            if username == db.hget(k, "username"):
                return (int(k), db.hget(k, "enabled"))
        except Exception:
            pass

    # If cicle didn't return username is not present
    raise ValueError("Unknown username: %s.", username)


# Send a simple log message to `admin_id` using the log bot
def send_log(message, cmd=None):
    if cmd is not None:
        try:
            botan.track(botan_token, message.from_user.id, to_json(message), cmd)
        except Exception:
            pass

    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    groupinfo = ""
    if is_group(message):
        groupinfo = "in group %s (%s)" % (message.chat.title, message.chat.id)
    text = "[%s]\n@%s\n(%s %s - %s)\n\n%s\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text, groupinfo)
    log_bot.send_message(admin_id, text)
    

# Send a simple feedback message to `admin_id` using the feedback bot
def send_feedback(message):
    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    text = "[%s]\n@%s\n(%s %s - %s)\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text)
    feedback_bot.send_message(admin_id, text)

