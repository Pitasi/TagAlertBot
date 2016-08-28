# TagAlertBot
Telegram bot that notifies users when they are tagged in groups.

You can freely user the bot already running: @TagAlertBot (http://telegram.me/tagalertbot)

Written in Python 3 and powered by
[pyTelegramBotAPI](https://github.com/eternnoir/pyTelegramBotAPI).

Support my project and keeping up the server by donating 50 cents: http://paypal.me/pitasi.

### Privacy
A lot of people asked for what is being logged and what I'm doing with these logs.

I'm not logging anything.

### Requirements
* Python 3
```bash
sudo apt-get install python3 python3-dev python3-setuptools
sudo easy_install3 pip
```

* pyTelegramBotAPI module
```bash
sudo pip3 install pyTelegramBotAPI
```
* A Telegram's bot token

Contact @BotFather (http://telegram.me/botfather) to create your bot account and get the token.

### Running the bot
```bash
# Clone this repo
$ git clone https://github.com/pitasi/TagAlertBot

# Open the folder just downloaded
$ cd TagAlertBot

# Create the configuration file based on example
$ cp config.py.example config.py

# Edit `tagalert.py` and `config.py` with you preferences.
# Finally run the bot
$ python3 tagalert.py
```

### Updating the bot
To be sure you are running the last version of TagAlert, just go inside the folder and:
```bash
$ git pull
```
then restart the script.

### How to be sure the bot doesn't restart or crash

I'm actually using [PM2](https://github.com/Unitech/pm2) to be sure that my bot is turned on, even if some exceptions occurs.

     It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.
