# TagAlertBot
Telegram bot that notifies users when they are tagged in groups.

Do you like my works? Help me buying a beer: http://paypal.me/pitasi.

![Tag Alert Bot](http://i.imgur.com/JGmQgEw.gif)

See the bot in action!
Add @TagAlertBot (http://telegram.me/tagalertbot) to your group!

Written in Node.js and powered by
[node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api).

### Privacy
A lot of people asked for what is being logged and what I'm doing with these logs.

I'm not logging anything.

### Requirements
* Node.js and npm

https://nodejs.org/en/download/package-manager/

* A Telegram's bot token

Contact @BotFather (http://telegram.me/botfather) to create your bot account and get the token.

### Running the bot
```bash
# Clone this repo
$ git clone https://github.com/pitasi/TagAlertBot

# Open the folder just downloaded
$ cd TagAlertBot

# Create the configuration file based on example
$ cp config.example.js config.js

# Edit `config.js`.

# Install dependencies
$ npm install node-telegram-bot-api

# Run the bot
$ node tagalert
```

### Updating the bot
To be sure you are running the last version of TagAlert, just go inside the folder and:
```bash
$ git pull
```
then restart the script.

### How to be sure the bot doesn't crash

I'm actually using [PM2](https://github.com/Unitech/pm2) to be sure that my bot is turned on, even if some exceptions occurs.

     It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.
