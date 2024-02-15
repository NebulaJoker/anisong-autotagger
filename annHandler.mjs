'use strict'

import fs from 'fs';
import { splitTheTitle, cleanTheTitle, waitTimeout, descendingSorterWithKeys } from "./generalUsage.mjs";
import { distance } from "fastest-levenshtein";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { XMLParser } = require("fast-xml-parser");
const options = {
    ignoreAttributes: false,
    tagValueProcessor: (tagName, tagValue, jPath, hasAttributes, isLeafNode) => {
        if (isLeafNode) return tagValue;
        return "";
    }
};
const parser = new XMLParser(options);
const xml2js = require('xml2js');

const annCache = (parser.parse(fs.readFileSync("./caches/reports.xml"))).report.item;
const annFullInfoCache = (JSON.parse(fs.readFileSync("./caches/annFullInfoCache.json")) || {})


export async function searchANNtitles(animeInfo) {
    let titles = [animeInfo.englishTitle, animeInfo.title, animeInfo.japaneseTitle];
    let annInfoBulk = await getANNEntry(titles, animeInfo.airdate.from, animeInfo.type);

    if (annInfoBulk.length === 0) {
        return -1;
    }

    return annInfoBulk[0].annID;
}


async function getANNEntry(animeTitles, airdate, type) {

    let annPossibilities = [];

    animeTitles = animeTitles.filter((entry) => entry != null);

    for (let title of animeTitles) {
        annPossibilities = await annGetAnimeInfo(title);
        annPossibilities = cleanUpPossibilitiesV2(annPossibilities, airdate, type, title);

        if (annPossibilities.length > 0) {
            break;
        }
    }

    return annPossibilities;
}


async function annGetAnimeInfo(animeTitle) {
    let possibilities = searchANNDatabaseByTitle(animeTitle);
    let possibilitiesIDs = possibilities.map((entry) => entry.id)
    possibilities = await getAnimePageInformation(possibilitiesIDs);

    return possibilities;
}


function cleanUpPossibilitiesV2(possibilities, malAirdate, type, title) {

    possibilities = possibilities.map((entry) => {

        entry.differenceInDays = Number.MAX_SAFE_INTEGER;
        entry.probability = 100;

        entry.differenceInDays = Math.abs(malAirdate - new Date(entry.vintage)) / 1000 / 60 / 60 / 24;
        entry.probability = (entry.probability - entry.differenceInDays) / distance(title, entry.name);

        if (entry.type !== type) {
            entry.probability = (entry.probability > 0) ? entry.probability / 2 : entry.probability * 2;
        }

        if (entry.probability === -Infinity) {
            entry.probability = Infinity;
        }

        return entry;
    });

    return possibilities.sort((a, b) => descendingSorterWithKeys(a, b, "probability", "name", title))
}





function searchANNDatabaseByTitle(englishTitle) {

    let titles = [splitTheTitle(englishTitle).filter((entry) => entry.length > 1),
    splitTheTitle(cleanTheTitle(englishTitle)).filter((entry) => entry.length > 1)];

    let clearPossibilities = [];
    let splitTitle = splitTheTitle(englishTitle);

    for (let granularityTitle of titles) {
        clearPossibilities = annCache.filter((entry) => {
            let cleanTitle = cleanTheTitle(entry.name.toString());
            return granularityTitle.some((v) => cleanTitle.includes(v));
        }).map((entry) => {
            let cleanTitle = cleanTheTitle(entry.name.toString());
            let i = 0;
            granularityTitle.forEach((v) => cleanTitle.includes(v) ? ++i : {})
            entry.probability = i;
            return entry;
        }).filter((entry) => entry.probability / granularityTitle.length >= 0.3).sort(
            (entryA, entryB) => {
                if (entryA.probability === entryB.probability) {
                    return distance(splitTitle.join(" "), cleanTheTitle(entryA.name)) - distance(splitTitle.join(" "), cleanTheTitle(entryB.name))
                }
                else {
                    return entryB.probability - entryA.probability;
                }
            });

        if (clearPossibilities.length > 0) {
            break;
        }
    }

    return clearPossibilities;
}


async function getAnimePageInformation(annIDs) {
    let toCacheANNIDs = annIDs.filter((entry) => !annFullInfoCache.hasOwnProperty(entry));

    while (toCacheANNIDs.length > 0) {
        let batch = toCacheANNIDs.splice(0, 50);
        let parsedXML = null;
        let requestURL = "https://cdn.animenewsnetwork.com/encyclopedia/api.xml?" + (batch.map((entry) => "anime=" + entry).join("&"));

        if (batch.length !== 0) {
            await fetch(requestURL)
                .then(response => response.text())
                .then(response => xml2js.parseStringPromise(response, { trim: true }).then((result) => parsedXML = result))
                .catch(err => err)
            await waitTimeout(2);

            parsedXML = parsedXML.ann.anime;

            parsedXML.forEach((entry) => {

                let miscInfo = getMiscInfo(entry["info"]);

                if (miscInfo === false) {
                    miscInfo = {
                        "vintage": new Date(("2099-12-31")),
                        "japaneseName": ""
                    }
                }

                const obj = {
                    "annID": entry["$"]["id"],
                    "name": entry["$"]["name"],
                    "type": fixType(entry["$"]["type"]),
                    "japaneseName": miscInfo["japaneseTitle"],
                    "vintage": turnVintageToDate(miscInfo["vintage"])
                }

                annFullInfoCache[obj.annID] = obj;
            })
        }

        fs.writeFileSync("./caches/annFullInfoCache.json", JSON.stringify(annFullInfoCache))
    }

    return annIDs.map((entry) => annFullInfoCache[entry]);
}


function getMiscInfo(info) {
    const obj = {
        japaneseTitle: "",
        vintage: new Date()
    }

    if (info === undefined) {
        return false;
    }

    let vintageArray = [];

    info.forEach((entry) => {
        if (entry["$"]["type"] === "Alternative title" && entry["$"]["lang"] === "JA") {
            obj.japaneseTitle = entry["_"];
        }
        else if (entry["$"]["type"] === "Vintage") {
            vintageArray.push(entry["_"]);
        }

    })

    if(vintageArray.length === 1){
        obj.vintage = vintageArray[0];
    }

    else{
        obj.vintage = (vintageArray.filter((entry) => isJapaneseAirdate(entry)))[0];
    }

    return obj;
}


function isJapaneseAirdate(string) {
    if (!string.includes("(") || string.includes("(Japan)") || string.includes("(Japan TV)") || string.includes("TV Premiere") || string.includes("Japan - TV"))
        return true;

    return false;
}


function fixType(type) {
    if (type === "movie") return "Movie"
    else if (type === "OAV") return "OVA"

    return type;
}


function turnVintageToDate(string) {
    let vintage = null;

    try {
        vintage.getDate();
    }
    catch {
        vintage = translateVintage(string);

        if (vintage.from === null) {
            return new Date("2035-12-31");
        }
        else {
            return new Date(`${vintage.from.year}-${vintage.from.month}-${vintage.from.day}`)
        }
    }

    return vintage;
}


function translateVintage(string) {

    if (typeof string === "undefined") {
        string = "";
    }
    else if (typeof string !== "string") {
        string = string.toString();
    }

    let splitDate = translateRegex(string);

    return {
        "from": {
            "day": splitDate[2],
            "month": splitDate[1],
            "year": splitDate[0]
        }
    }
}


function translateRegex(string) {
    let dateRegex = new RegExp("-", "g");
    let splitDate = [];

    switch ((string.match(dateRegex) || []).length) {

        case 5: {
            splitDate = string.split(" ");
            splitDate = splitDate[0]
            return splitDate.split("-").map((num) => num);
        }

        case 4: {
            splitDate = string.split(" ");
            splitDate = splitDate[0]
            return splitDate.split("-").map((num) => num);
        }

        case 2: {
            return splitDate = string.split("-").map((num) => num);
        }

        case 1: {
            splitDate = string.split("-").map((num) => num);
            return splitDate.push(25);
        }

        case 0: {
            splitDate = parseInt(string);
            if (Number.isNaN(splitDate)) {
                splitDate = 2000;
            }
            splitDate = [splitDate];
            splitDate.push(1);
            splitDate.push(1);
            return splitDate;
        }

        default: {
            return { "from": null };
        }
    }
}