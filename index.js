const Task = require('data.task')
const request = require('request');
const minInstallDelay = 30
const c = require('./commonFunctions.js')
const args = process.argv.slice(2)


function options(req, withTrace) {
    let path = withTrace ? "?tracing=Youapp1!" : ""
    return {
        url: req.server + "/online" + path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        json: req.body
    }
}

function badFlow(flow) {
  return new Task(function (reject, resolve) {
    reject("bad flow [" + flow + "]")
  })
}

function onlineAds(options) {
    return new Task(function (reject, resolve) {
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) resolve(body)
            else if (error) reject(error)
            else if (response.statusCode == 400) reject("failed to get /online wrong request body = " + JSON.stringify(body))
            else reject("failed to get /online wrong request statusCode = " + response.statusCode)
        })
    })
}

function pickAd(response) {
    parsedBody = JSON.parse(JSON.stringify(response))
    ads = parsedBody.ad_units[0].ads

    return new Task(function (reject, resolve) {
        if (ads.length > 0) {
            rnd = c.random(ads.length)
            return resolve(ads[rnd])
        } else return reject("no ads")
    })
}


function extractImpressionHost(ad) {
    return ad.tracking_urls.impression_url;
}


function sendImpression(url) {
    return new Task(function (reject, resolve) {
        let getOpt = {
            url: url,
            method: 'GET'
        }

        request(getOpt, function (error, response, body) {
            if (response.statusCode == 200) resolve("impression sent to " + url)
            else reject(response)
        })
    })
}

function exctractClickUrl(ad) {
  return {
        url: ad.tracking_urls.click_url,
        id: ad.ad_id,
        imageUrl: ad.creatives.image_url
    }
}

function sendClick(clickParams) {
    return new Task(function (reject, resolve) {
        var getOpt = {
            url: clickParams.url,
            method: 'GET'
        }

        request(getOpt, function (error, response, body) {
            if (response.statusCode == 200) resolve(clickParams)
            else reject(response)
        })
    })
}

function buildInstallParam(clickParams) {
    var appId = clickParams.imageUrl.split("/")[5]
    return clickParams.id + "_" + appId + "_2017-09-05"
}

function sendInstall(installParam, server) {
    params = {
        params: installParam,
        trackerToken: "4a627ae8-baca-436d-88fd-16b32a7a2d20"
    }
    asQuery = c.objToParams(params);
    return new Task(function (reject, resolve) {
        var getOpt = {
            url: server + "/installs?" + asQuery,
            method: 'GET'
        }

        request(getOpt, function (error, response, body) {
            if (!error && response.statusCode == 200) resolve(response)
            else if (error) reject(error)
            else reject(response.body)
        })
    })
}

function trace(response) {
    parsedBody = JSON.parse(JSON.stringify(response))
    return parsedBody.ad_units[0].trace
}

function scoredMap(logs) {
    scored = logs.filter(log => log.indexOf("||") > 0)

    return filterReasons(logs).concat(scored.map(log => {
        values = log.split("||")
        return {
            'businessPartnerId': values[11],
            'prtProductId': values[14],
            'tEcmp': values[19],
            'cmpName': values[2],
            'pti': values[25],
            'valuation': values[26],
            'profitable': values[27]
        }
    }))

}

let mode = args.length == 0 ? "rec" : args[0]
let req = c.requestFromArgs(args)

const onlyRecomandationFlow = onlineAds(options(req, false));
const recomandationWithTraceFlow = onlineAds(options(req, true));
const recomandationWithScoredTraceFlow = recomandationWithTraceFlow.map(trace).map(scoredMap);
const sendImpressionFlow = onlyRecomandationFlow.chain(pickAd).map(extractImpressionHost).chain(sendImpression)

const allFlow = function() {

  let ad = onlyRecomandationFlow.chain(pickAd)

   ad
   .map(extractImpressionHost)
   .chain(sendImpression)

  return ad
  .map(exctractClickUrl)
  .chain(sendClick)
  .map(a => c.wait(a, minInstallDelay))
  .map(buildInstallParam)
  .chain(params => sendInstall(params, req.server))
  .map(() => "Install sent")

}()


function flowByMode(mode) {
  var flow = badFlow(mode)
    if (mode === "rec") flow = onlyRecomandationFlow
    else if (mode === "trace") flow = recomandationWithTraceFlow
    else if (mode === "traceScored") flow = recomandationWithScoredTraceFlow
    else if (mode === "imp") flow = sendImpressionFlow
    else if (mode === "all") flow = allFlow

  return flow;
}


//MAIN
flowByMode(mode)
.fork(
    function (error) {
        console.log(error)
    },
    function (data) {
        console.log(data)
    })
