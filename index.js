const Task = require('data.task')
const request = require('request');
const minInstallDelay = 30
const c = require('./commonFunctions.js')
const args = process.argv.slice(2)

let req = c.requestFromArgs(args)



/* Flows: */
const onlyRecomandationFlow = onlineAds(options(req, false));
const onlyRecomandationFlowAdNames = onlineAds(options(req, false))
                                        .map(res => res.ad_units[0].ads.map(a => a.app_info.app_name));
const recomandationWithTraceFlow = onlineAds(options(req, true)).map(trace);
const recomandationWithScoredTraceFlow = recomandationWithTraceFlow.map(scoredMap);
const sendImpressionFlow = onlyRecomandationFlow
                                .chain(pickAd).map(extractImpressionHost)
                                .chain(sendImpression);

const sendClikFlow = createSendClickFlow().map(() => "Click Sent");
           
const completeFlow = function() {
  return createSendClickFlow()
  .map(a => c.wait(a, minInstallDelay))
  .map(buildInstallParam)
  .chain(params => sendInstall(params, req.server))
  .map(() => "Install sent")
}();

function flowByMode(mode) {
    var flow
    switch (mode) {
        case "rec":
            flow = onlyRecomandationFlowAdNames
            break;
        case "trace":
            flow = recomandationWithTraceFlow
            break;
        case "traceScored":
            flow = recomandationWithScoredTraceFlow
            break;
        case "imp":
            flow = sendImpressionFlow
            break;
        case "imp":
            flow = sendImpressionFlow
            break;
        case "click":
            flow = sendClikFlow
            break;
        case "all":
            flow = completeFlow
            break;
        case "help":
            flow = help
            break;
        default:
            break;
    }
  return flow;
}

function createSendClickFlow() {
    let ad = onlyRecomandationFlow.chain(pickAd)
  
    ad
     .map(extractImpressionHost)
     .chain(sendImpression)
  
    return ad
    .map(exctractClickUrl)
    .chain(sendClick)
  }

function main(commandLineArgs) {
  let mode = commandLineArgs.length == 0 ? "rec" : args[0]

  flowByMode(mode)
  .fork(
    function (error) {
        console.error(error)
    },
    function (data) {
        console.log(data)
    })
  }

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
    let appId = clickParams.imageUrl.split("/")[5]
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

function filterReasons(logs) {
  return logs.slice(0, 5);
}

function trace(response) {
    parsedBody = JSON.parse(JSON.stringify(response))
    return parsedBody.ad_units[0].trace
}

function readablePti(x) {
  return Number.parseFloat(x).toFixed(20);
}

function scoredMap(logs) {
    scored = logs.filter(log => log.indexOf("||") > 0)

    return filterReasons(logs).concat(scored.map(log => {
        values = log.split("||")

        return {
            'cmpName': values[2],
            'pti': readablePti(values[23]),
            'profitable': values[32],
        }
    }))

}

const help = new Task(function (reject, resolve) {
  return resolve(" format: mode --env=[env] --country=[countryCode] --ac=[accessToken]\n" +
      "Modes: \n" +
      " rec - only recomendation with app names \n" +
      " trace - only recomendation with trace \n" +
      " traceScored - only recomendation with parsed trace \n" +
      " imp - recomendation and impression \n" +
      " click - recomendation, impression and click \n" +
      " all - recomendation, impression, click and install \n" +
      "Access Tokens: \n" +
      " default - 79e49603-aa64-48e3-aa48-47823c10825f\n" +
      " localWithModel705\n" +
      " localNoModel867\n" +
      " stgWithModel\n"
    )})


main(args)
