consts = require('./consts.js');
const sleep = require('sleep');
const mixin = require('mixin-object');

const envIndex = 0
const countryIndex = 2
const accessTokenIndex = 3

module.exports = {

  requestFromArgs: function(args) {
    let env = this.flagValue(args, "--env", "local")
    let country = this.flagValue(args, "--country", "us")
    let accessToken = this.flagValue(args, "--ac", "fa2cb362-3b16-4a26-82bb-3af0be3efecd")

    let withCountry = this.country(country)
    let withAt = this.accessToken(accessToken)

    return {
     "server": consts.servers[env],
     "body": withAt
   }
 },

 accessToken: function(at) {
   let token = at in consts.accessTokens ? consts.accessTokens[at] : at
   let ato = {'access_token': token}
   return mixin(consts.defaultRequest, ato)
 },

 country: function(code) {
      let ip = consts.ipPerCountries[code]
      let wIp = {'ip': ip}
      let ui = consts.defaultRequest['user_info']
      let userInfo = mixin(ui, wIp)
      return mixin(consts.defaultRequest, {'user_info': userInfo})
 },

 random: function (numOfAds) {
     return Math.floor(Math.random() * numOfAds);
 },

 objToParams: function (obj) {
     return Object.keys(obj).map(function (key) {
         return key + '=' + obj[key];
     }).join('&');
 },

wait: function(content, seconds) {
     console.log("sleep for " + seconds)
     sleep.sleep(seconds)
     return content;
 },

 log:  function(content) {
     console.log(content)
     return content;
 },

 flagValue: function(args, flagPrefix, defaultValue) {
  let flag = args.find((f) => f.startsWith(flagPrefix))
   return flag == undefined ? defaultValue : flag.split('=')[1]
}

}
