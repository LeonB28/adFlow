var Task = require('data.task')
var request = require('request');
var sleep = require('sleep');
var server = "http://localhost:8888"
var minInstallDelay = 24

var headers = {
    'Content-Type': 'application/json'
}

const random = function (numOfAds) {
    return Math.floor(Math.random() * numOfAds);
}

const objToParams = function (obj) {
    return Object.keys(obj).map(function (key) {
        return key + '=' + obj[key];
    }).join('&');
}

const onlineRequestBody = {
    "access_token": "fe7eb6fa-265d-4cf7-b076-76c42c1e4ce9",
    "request_origin": "server",
    "publisher_info": {
        "app_id": "com.surpax.some.ad",
        "publisher_token": "ads.mopub.com"
    },
    "user_info": {
        "ip": "72.229.28.185",
        "user_agent": "Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19",
        "user_id": {
            "gaid": "a571a19b-93d0-4ac5-8451-471949bdf915"
        },
        "name": "myName"
    },
    "ad_units": [
        {
            "1": "2",
            "ad_unit_id": "aa",
            "ad_unit_type": "image",
            "ad_unit_num": "15",
            "ad_properties": {
                "image_dimensions": "300x250"
            }
        }
    ]
}

const options = {
    url: server + "/online",
    method: 'POST',
    headers: headers,
    json: onlineRequestBody
}

onlineAds = new Task(function (reject, resolve) {
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) resolve(body)
        else if (error) reject(error)
        else if (response.statusCode == 400) reject("failed to get /ads wrong request body=" + body)
        else reject("failed to get /ads wrong request")
    })
})

function pickAd(response) {
    parsedBody = JSON.parse(JSON.stringify(response))
    ads = parsedBody.ad_units[0].ads
    rnd = random(ads.length)
    return ads[rnd]
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

function sendInstall(installParam) {
    params = {
        params: installParam,
        trackerToken: "4a627ae8-baca-436d-88fd-16b32a7a2d20"
    }
    asQuery = objToParams(params);
    return new Task(function (reject, resolve) {
        var getOpt = {
            url: server + "/installs?" + asQuery,
            method: 'GET'
        }

        request(getOpt, function (error, response, body) {
            if (response.statusCode == 200) resolve("done")
            else reject(response.body)
        })
    })
}

function wait(content, seconds) {
    console.log("sleep for " + seconds)
    sleep.sleep(seconds)
    return content;
}

onlineAds                                           
    .map(pickAd)
    .map(exctractClickUrl)
    .chain(sendClick)
    .map(a => wait(a, minInstallDelay))
    .map(buildInstallParam)
    .chain(sendInstall)
    .fork(
        function (error) {
            console.log(error)
        },
        function (data) {
            console.log(data)
        }
    )