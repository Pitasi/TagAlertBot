#############################################
#                                           #
#  AUXILIARY FUNCTIONS                      #
#                                           #
#############################################

from config import *
import threading
from time import time, strftime

lock = threading.Lock()

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
        global known_users
        known_users += 1
        users[str(userid)] = {
                                "username"  : username,
                                "enabled"   : enabled,
                                "banned"    : banned
                              }

        # Write modifications to file
        lock.acquire()
        with open(users_json, 'w') as jsf:
            json.dump(users, jsf)
        lock.release()

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
        lock.acquire()
        with open(users_json, 'w') as jsf:
            json.dump(users, jsf)
        lock.release()

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
    text = "[%s]\n@%s\n(%s %s - %s)\n\n%s\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text, groupinfo)
    log_bot.send_message(admin_id, text)
    

# Send a simple feedback message to `admin_id` using the feedback bot
def send_feedback(message):
    timestamp = strftime("%Y-%m-%d %H:%M:%S")
    text = "[%s]\n@%s\n(%s %s - %s)\n\n%s" % (timestamp, message.from_user.username, message.from_user.first_name, message.from_user.last_name, message.from_user.id, message.text)
    feedback_bot.send_message(admin_id, text)

