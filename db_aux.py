from config import *
from boot import *

# Check if a retrieve command is still valid
def is_valid_retrieve(string):
    db.incr("retrieves:"+string)
    if int(db.get("retrieves:"+string)) > 2:
        return False

    db.expire("retrieves:"+string, 259200)
    return True
    
    
#############################################
# USERS                                     #
#############################################

# Check if user is present in DB
def check_user(user_id):
    return db.exists("user:"+str(user_id))


# Check if user_id is flooding
def is_flooding(user_id):             
    tmp = db.get("flood:"+str(user_id))

    if tmp is not None and int(tmp) >= 5:
        ban_user(user_id)
        try:
            bot.send_message(user_id, lang('flooding_banned', user_id))
        except Exception:
            pass
        log_bot.send_message(admin_id, "User %s banned for flooding." % user_id) 
        return True
   
    ttl = db.ttl("flood:"+str(user_id))
    db.incr("flood:"+str(user_id))
    if ttl is None:
        ttl = 5
    db.expire("flood:"+str(user_id), ttl)
    return False


# Check if user_id is banned
def is_banned(user_id):
    return db.sismember("banned", str(user_id))


# Check if user_id1 is ignoring user_id2
def is_ignored(user_id1, user_id2):
    return db.sismember("ignore:"+str(user_id1), user_id2)


# Check if user_id is enabled
def is_enabled(user_id):
    return db.hget("user:"+str(user_id), "enabled") == "True"
    
    
# Ban by user_id
def ban_user(user_id):
    return db.sadd("banned", user_id)


# Unban by user_id
def unban_user(user_id):
    return db.srem("banned", user_id)


# Add user_id2 to ignored list of user_id1
def ignore(user_id1, user_id2):
    return db.sadd("ignore:"+str(user_id1), user_id2)


# Remove user_id2 from ignored list of user_id1
def unignore(user_id1, user_id2):
    return db.srem("ignore:"+str(user_id1), user_id2)


# Get string localized, or english
def lang(code, user_id):
    l = db.hget("user:"+str(user_id), "lang")
    try:
        return replies[l][code]
    except KeyError:
        return replies['en'][code]


# Add user to DB using passed arguments
def add_user(user_id, username = "place-holder", lang = "en", enabled = False):
    # Check if users not alredy present
    if not check_user(user_id):
        log_bot.send_message(admin_id, "[%s]\nAdding user @%s (id: %s) to database." % (strftime("%Y-%m-%d %H:%M:%S"), username, user_id))
        # Add user
        global known_users
        known_users += 1
        
        db.hset("user:"+str(user_id), "username", username.lower())
        db.hset("user:"+str(user_id), "lang", lang)
        db.hset("user:"+str(user_id), "enabled", enabled)       

    else:
        raise ValueError("Trying to add a known user to database.")


# Update user_id row in DB with passed arguments. (If 'None' is passed, value won't be modified)
def update_user(user_id, new_username=None, new_lang=None, new_enabled=None):
    # Check if users exists
    if check_user(user_id):
        # Update the right fields
        if new_username is not None:
            db.hset("user:"+str(user_id), "username", new_username.lower())
        if new_lang is not None:
            db.hset("user:"+str(user_id), "lang", new_lang)
        if new_enabled is not None:
            db.hset("user:"+str(user_id), "enabled", new_enabled)

    else:
        log_bot.send_message(adminid, "Trying to update an unknown user: %s." % user_id)
        raise ValueError("Trying to update an unknown user.")


# Get user_id and enabled from username. Return them as a couple (id, enabled)
def get_by_username(username):
    username = username.lower()

    for k in db.scan_iter('user:*'):
        try:
            if username == db.hget(k, "username"):
                user_id = int(k[5:])
                return (user_id, is_enabled(user_id))
        except Exception as e:
            pass

    # If cicle didn't return username is not present
    raise ValueError("Unknown username: %s.", username)



#############################################
# GROUPS                                    #
#############################################

# Store users and chat informations
def store_info(message):
    # Add the user as known in the group
    if message.chat.id < 0:
        # Chat is group or supergroup
        add_to_group(message.from_user.id, message.chat.id)
        db.set("groupnames:"+str(message.chat.id), message.chat.title)
    
    name = message.from_user.username
    try:
        add_user(message.from_user.id, "place-holder" if name is None else name)
    except ValueError:
        # User already present
        if name is not None:
            update_user(message.from_user.id, name)
        pass
        
        
# Remove a group from database
def remove_group(group_id):
    return db.delete("group:"+str(group_id))


# Add user in a group
def add_to_group(user_id, group_id):
    db.sadd("group:"+str(group_id), str(user_id))


# Delete from group
def remove_from_group(user_id, group_id):
    db.srem("group:"+str(group_id), str(user_id))
    

# Get participants of a group
def participants(group_id):
    return db.smembers("group:"+str(group_id))


# Get a list of user_id's groups
def groups_list(user_id):
    res = []
    for k in db.scan_iter("group:*"):
        if db.sismember(k, str(user_id)):
            res.append(int(k[6:]))
    return res


# Get group name from chat id
def group_name(group_id):
    res = db.get("groupnames:"+str(group_id))
    if res is None:
        raise ValueError("Group not found")
    return res
    

# Check if user is in a group
def is_in_group(user_id, group_id):
    return str(user_id) in participants(group_id)
