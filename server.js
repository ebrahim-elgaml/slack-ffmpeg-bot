var config = require("./config.js"),
    express = require('express'),
    SlackBot = require('slackbots'),
    ffmpeg = require('fluent-ffmpeg'),
    fs = require('fs'),
    https = require('https'),
    jsonfile = require('jsonfile');
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
});
bot.on('message', function(data) {
    analyizeMessage(data);
    console.log(data);
});
function analyizeMessage(data){
  if(data.type == "file_deleted"){
    return;
  }
  if(data.type == "message" && data.text.indexOf("how") > -1 && data.text.indexOf("compress") > -1){
    var user = getUser(bot.getUsers()._value.members, data.user);
    howToCompress(data, user);
  }else if(data.type == "message" && data.text.indexOf("token=") > -1 && data.text.indexOf("YOURTOKEN") <= -1){
    var user = getUser(bot.getUsers()._value.members, data.user);
    saveMyToken(data, user);
  }else if(data.type == "message" && data.subtype == "file_share"  && data.user != null  && data.file != null && data.file.filetype == "mp4" && data.text.indexOf("compress") > -1 ){
    var user = getUser(bot.getUsers()._value.members, data.user);
    var testToken = getUserToken(data, user);
  }
}
function getUser(users, userId){
  for(var u in users){
    console.log(users[u]);
    if(users[u].id == userId){
      return users[u].name;
    }
  }
  return null;
}

function compressOnlineVideo(videoId, path, data, token, user){
  if(user == null){
    return;
  }
  bot.postMessageToUser(user, "Fetching the video", params);
  var proc = new ffmpeg(path)
      .addOption('-c:v',  'libx264', '-profile:v', 'baseline', '-level', '3.0', '-b:v', '800k')
      .addOption('-g', 10, '-qmin', 10, '-qmax', 51, '-i_qfactor', 0.71, '-qcomp', 0.6, '-me_method', 'hex')
      .addOption('-subq', 5, '-r', 20/1 ,'-pix_fmt', 'yuv420p')
      .addOption('-c:a', 'libfdk_aac', '-ac', 2 ,'-ar', 44100)
      .on('progress', function(progress) {
         bot.postMessageToUser(user, "Do not worry still working for you on "+  videoId + "_modified" + ".mp4 " +": " + 'Processing: ' + progress.frames + ' frames  done', params);
      })
      .on('start', function(commandLine) {
        console.log("%s: Spawned FFmpeg with command: %s", commandLine);
      })
      .on('end', function() {
        console.log("DONE");
        var url = "https://slack.com/api/files.delete?token=" + token + "&file=" + data.file.id;
        var request = https.get(url, function(res) {
          console.log('STATUS: ' + res.statusCode);
          console.log('HEADERS: ' + JSON.stringify(res.headers));
          console.log("Data data data data data " + user)
          res.setEncoding('utf8');
          res.on('data', function (chunk) {
            bot.postMessageToUser(user, "Here is the link : " + videoId + "_modified" + ".mp4" + " , and I have deleted the original file to save space on Slack.", params);
            return;
          });
        });

        // setTimeout(deleteVideoFromLink(data, token), 5000)

     })
     .save(videoId + "_modified" + ".mp4");
}
function howToCompress(data, user){
  bot.postMessageToUser(user, "Go to the link  : https://api.slack.com/docs/oauth-test-tokens \n If you have token copy it and send it to me \n If not generate a token and send it to me \n you should send it in the format token=YOURTOKEN \n Then upload the video and call me in the comment to compress it for you by typing compress lucy", params);
}
function saveMyToken(data, user){
  var token = data.text.split("=");
  var record = { user: data.user, token: token[token.length - 1]}
  fs.exists("user-tokens.json", function (exists) {
    if(exists){
      jsonfile.readFile("user-tokens.json", function(err, obj) {
        var found = false;
        for(var i = 0 ; i < obj.length ; ++i){
          if(obj[i].user == data.user){
            obj[i].token = token[token.length - 1];
            found = true;
            break;
          }
        }
        if(!found){
          obj.push(record);
        }
        jsonfile.writeFile("user-tokens.json", obj, {spaces: 2}, function(err) {
          console.error(err);
          bot.postMessageToUser(user, "I have saved your token do not worry I will not share it with anyone", params);
        })
      })
    }else{
      var array = new Array();
      array.push(record);
      jsonfile.writeFile("user-tokens.json", array, {spaces: 2}, function(err) {
        console.error(err);
        bot.postMessageToUser(user, "I have saved your token do not worry I will not share it with anyone", params);
      })
    }
  })
}
function getUserToken(data, user){
  console.log("GET USER TOKEN XXXXXXXXXXXXXXX L " + user);
  fs.exists("user-tokens.json", function (exists) {
    if(exists){
      jsonfile.readFile("user-tokens.json", function(err, obj) {
        var found = false;
        var token = null;
        for(var i = 0 ; i < obj.length ; ++i){
          if(obj[i].user == data.user){
            found = true;
            token = obj[i].token;
            break;
          }
        }
        if(found){
          console.log("TOKEN YYYYYYYYYYYYYYYY" + user);
          sendCompressRequest(data, token, user);
          return token;
        }else{
          bot.postMessageToUser(user, "Please follow the following steps to add your token first : ", params);
          howToCompress(data, user);
          return null;
        }
      });
    }else{
      bot.postMessageToUser(user, "Please follow the following steps to add your token first : ", params);
      howToCompress(data, user);
      return null;
    }
  })
}
function sendCompressRequest(data, token, user){
  console.log("USERLINK link ZZZZZZZZZZZZZZZZ " + user);
  var url = "https://slack.com/api/files.sharedPublicURL?token=" + token + "&file=" + data.file.id;
  var request = https.get(url, function(res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));
    console.log("Data data data data data " + user)
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      if(JSON.parse(chunk).ok){
        var downloadURL = generatePublicURL(data.file.permalink_public, data.file.url_private);
        console.log("Download link " + downloadURL);
        console.log("USERLINK link " + user);
        compressOnlineVideo(data.file.id, downloadURL, data, token, user);
      }else{
        bot.postMessageToUser(user, JSON.parse(chunk).error, params);
        bot.postMessageToUser(user, "Please follow the following steps to add your token first : ", params);
        howToCompress(data, user);
      }
    });
  });
}
function deleteVideoFromLink(data, token){
  var url = "https://slack.com/api/files.delete?token=" + token + "&file=" + data.file.id;
  var request = https.get(url, function(res) {
    });
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
