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

I'm not logging anything.

### Requirements
* Python 3
```bash
sudo apt-get install python3 python3-dev
sudo apt-get install python3-setuptools
sudo easy_install3 pip
```

* pyTelegramBotAPI module
```bash
sudo pip3 install pyTelegramBotAPI
```
* A Telegram's bot token

[How to obtain a token for telegram](https://unnikked.ga/getting-started-with-telegram-bots/)


### Run the bot
```bash
git clone https://github.com/pitasi/TagAlertBot
```

Edit `tagalert.py` with you preferences.

```bash
cd TagAlertBot
python3 tagalert.py
```

### How to be sure the bot doesn't restart or crash

I'm actually using [PM2](https://github.com/Unitech/pm2) to be sure that my bot is turned on, even if some exceptions occurs.

     It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.
