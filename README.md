# TagAlertBot
Telegram bot that notifies users when they are tagged in groups, 
with advanced features and multi-language support.

You can freely user the bot already running: @TagAlertBot (http://telegram.me/tagalertbot)

Written in Python 3 and powered by
[pyTelegramBotAPI](https://github.com/eternnoir/pyTelegramBotAPI).

Support my project and keeping up the server by donating 50 cents: http://paypal.me/pitasi.

This Readme file is a work in progress.

### Privacy
A lot of people asked for what is being logged and what I'm doing with these logs.

Just to be sure, I'm not reading all of your messages, they are a lot and I'm not going to waste my time doing this :)

_So, what I am logging?_ I log every message that triggers the bot: that means commands, tags, and people entering/leaving a group.

_Why you need to log all this stuff?_ I'm doing this just to be sure that bot is safe and not being used for flooding, spamming, etc.

_Where are the logs files?_ There are no logs files. I'm using an auxiliary bot to send to myself the logs.
This way I can be updated in every moment and check for users report even if I am not in front of my computer.

### Commands available

| Command           | Description                                           |
| ----------------- | ----------------------------------------------------- |
| /help             | Show a presentation message.                          |
| /enable           | Enable notifications for the user.                    |
| /disable          | Disable notifications for the user.                   |
| /retrieve_[CODE]  | Search for the message inside the relative group.     |
| /ignore_[CODE]    | Ignore notifications from a specific user.            |
| /unignore_[CODE]  | Unignore notifications from a specific user.          |
| /groups           | Show a list of groups in which user is known          |
| /setlang          | Show a list of available languages                    |
| /donate           | Show a PayPal link for donating to dev                |
| /sourcecode       | Show a link to this repository                        |
| /feedback         | Send a message to dev through the Feedback Bot        |
| /ban [ID]         | Ban an user from using the bot (admin only)           |
| /unban [ID]       | Unban an user                                         |
| /stats            | Show some statistics                                  |
| /credits          | Show credits for bot and translations                 |

### Requirements
* Python 3
```bash
sudo apt-get install python3 python3-dev
sudo apt-get install python3-setuptools
sudo easy_install3 pip
```

* A Redis server __and__ his relative python's module
```bash
sudo apt-get install redis
sudo pip3 install redis
```

* pyTelegramBotAPI module
```bash
sudo pip3 install pyTelegramBotAPI
```

* Six module
```bash
sudo pip3 install six
```

* Three Telegram's bot tokens _(for main bot, log bot, and feedback bot)_

[How to obtain a token for telegram](https://unnikked.ga/getting-started-with-telegram-bots/)
 

### Run the bot
First of all, you need to gather all the scripts in this repository.<br>
In your terminal just:
```bash
git clone https://github.com/pitasi/TagAlertBot
```

Then open the folder just created:
```bash
cd TagAlertBot
```
And make sure `main.py` is executable:
```bash    
chmod +x main.py
```

Finally, to run the bot:
```bash
./main.py
```
    
### How to be sure the bot doesn't restart or crash

I'm actually using [PM2](https://github.com/Unitech/pm2) to be sure that my bot is turned on, even if some exceptions occurs.

     It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.

