var config = require("./config.js"),
    express = require('express'),
    SlackBot = require('slackbots'),
    ffmpeg = require('fluent-ffmpeg'),
    fs = require('fs'),
    https = require('https');

var testToken = config.slack_token;
var app = express();
var bot = new SlackBot({
    token: config.bot_token, // Add a bot https://my.slack.com/services/new/bot and put the token
    name: 'lucy'
});
var params = {
    icon_emoji: ':cat:'
};

bot.on('start', function() {
    bot.postMessageToChannel('general', 'meow!', params);
  //  console.log("Users : " + JSON.stringify(bot.getUsers()._value.members));
});
bot.on('message', function(data) {
  //console.log("Users : " + bot.getUsers()._value.members);
    analyizeMessage(data);
    console.log(data);
});
function analyizeMessage(data){
  if(data.type == "message" && data.text.indexOf("how") > -1 && data.text.indexOf("compress") > -1){
    var user = getUser(bot.getUsers()._value.members, data.user);
    howToCompress(data, user);
    return;
  }
  if(data.type == "message" && data.text.indexOf("token") > -1){
    var user = getUser(bot.getUsers()._value.members, data.user);
    saveMyToken(data, user);
    return;
  }
  if(data.type != "message" || data.user == null || data.file == null || data.file.filetype != "mp4"){
    return;
  }
  if(data.text.indexOf("compress") > -1){
    var url = "https://slack.com/api/files.sharedPublicURL?token=" + testToken + "&file=" + data.file.id;
    var request = https.get(url, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        var downloadURL = generatePublicURL(data.file.permalink_public, data.file.url_private);
        console.log("Download link " + downloadURL);
        compressOnlineVideo(data.file.id, downloadURL, data);

      });
    });
  }
}
function getUser(users, userId){
  // console.log(users);
  for(var u in users){
    console.log(users[u]);
    if(users[u].id == userId){
      return users[u].name;
    }
  }
  return null;
}

function compressOnlineVideo(videoId, path, data){
  var user = getUser(bot.getUsers()._value.members, data.user);
  if(user == null){
    return;
  }
  howToCompress(data, user);
  bot.postMessageToUser(user, "Fetching the video", params);
  var proc = new ffmpeg(path)
      .addOption('-c:v',  'libx264', '-profile:v', 'baseline', '-level', '3.0', '-b:v', '800k')
      .addOption('-g', 10, '-qmin', 10, '-qmax', 51, '-i_qfactor', 0.71, '-qcomp', 0.6, '-me_method', 'hex')
      .addOption('-subq', 5, '-r', 20/1 ,'-pix_fmt', 'yuv420p')
      .addOption('-c:a', 'libfdk_aac', '-ac', 2 ,'-ar', 44100)
      .on('progress', function(progress) {
        bot.postMessageToUser(user, "Do not worry still working for you : " + 'Processing: ' + progress.frames + ' frames  done', params);
      })
      .on('start', function(commandLine) {
        console.log("%s: Spawned FFmpeg with command: %s", commandLine);
      })
      .on('end', function() {
        console.log("DONE");
        bot.postMessageToUser(user, "Here is the link : " + videoId + "_modified" + ".mp4", params);
     })
     .save(videoId + "_modified" + ".mp4");
}
function howToCompress(data, user){
  bot.postMessageToUser(user, "Go to the link  : https://api.slack.com/docs/oauth-test-tokens \n If you have token copy it and send it to me \n If not generate a one and send it to me \n you should send it in the format token=YOURTOKEN", params);
}
function saveMyToken(data, user){
  var token = data.text.split("=");
  
  bot.postMessageToUser(user, "I have saved your token do not worry I will not share it with anyone", params);
}
function generatePublicURL(permalink_public, url_private){
  var s = permalink_public.split("-");
  s = s[s.length - 1];
  console.log("String kewy : " + s);
  return url_private + "?pub_secret=" + s;
}

app.listen(8080, function () {
  console.log('Server started listening on %d', "8080");
});
