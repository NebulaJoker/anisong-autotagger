import fs from 'fs'
import path from 'path'
import { createRequire } from "module";
import fetch from 'node-fetch'
const require = createRequire(import.meta.url);
const { distance, closest } = require('fastest-levenshtein');
const __dirname = path.resolve();


export async function waitTimeout(n) {
    await new Promise(r => setTimeout(r, n * 1000));
}


export function getClosestResult(title, results) {

    let closestNames = [];
    let match = null;

    for (let entry of Object.keys(results)) {
        closestNames.push(closest(title, results[entry].names))
    }

    match = closest(title, closestNames);

    for (let entry of Object.keys(results)) {
        if (results[entry].names.includes(match)) {
            results[entry].mainTitle = match;
            return results[entry];
        }
    }

    return null;
}


export async function downloadCover(url, malID) {
    return await fetch(url).then(res =>
        res.body.pipe(fs.createWriteStream(__dirname + "/caches/covers/" + malID + ".jpg"))
            .on('error', () => { return null; })
            .on('finish', async () => { }));
}


export function getTrackInformation(type, number, music) {
    type = translateShorthand(type).toLowerCase();

    for (let song of music[type]) {
        if (song.number == number) {
            return song;
        }
    }
}


export function translateShorthand(shorthand) {
    switch (shorthand) {
        case "OP": {
            return "Opening"
        };
        case "ED": {
            return "Ending"
        };
        case "IN": {
            return "Insert"
        };
    }
}


export function sanitizeJapaneseTitle(animeTitle) {
    return animeTitle.replaceAll(/[^a-zA-Z0-9 \u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF\u2605-\u2606\u2190-\u2195\u203B]/g, " ")
}


export function sanitizeEnglishTitle(animeTitle) {
    return animeTitle.replaceAll(/[^a-zA-Z0-9 ]/g, " ")
}

export function initializeDateFromString(string) {
    try {
        return new Date(string)
    }
    catch {
        return new Date();
    }
}

export function splitTheTitle(title) {
    return title.split(" ").filter((entry) => entry !== "")
}

export function normalizeTheTitle(title) {
    return title.toLowerCase();
}

export function cleanTheTitle(title) {
    return splitTheTitle(normalizeTheTitle(sanitizeEnglishTitle(title.normalize("NFD")))).join(" ");
}

export function descendingSorterWithKeys(a, b, mainKey, tieKey, tiebreaker) {
    if (b[mainKey] === a[mainKey]) {
        return distance(a[tieKey], tiebreaker) - distance(b[tieKey], tiebreaker)
    }
    return b[mainKey] - a[mainKey];
}

export function jaccardIndex(str1, str2) {
    let intersection = str1.filter((token) => str2.includes(token));
    return (intersection.length / (str1.length + str2.length - intersection.length))
}

export function sorensenDice(str1, str2) {
    let intersection = str1.filter((token) => str2.includes(token));
    return ((2 * intersection.length) / (str1.length + str2.length))
}

export function overlapSimilarity(str1, str2) {
    let intersection = str1.filter((token) => str2.includes(token));

    if (str1.length >= str2.length) {
        return intersection.length / str1.length;
    }

    else {
        return intersection.length / str2.length;
    }
}