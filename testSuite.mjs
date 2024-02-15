import fs from 'fs';

var success = 0;
var failure = 0;
var testModeFailures = [];

export function testValidity(annIDtoTest, annIDSmatchingSongs, failureDumpInfo) {

    try {
        if (annIDSmatchingSongs.some((element) => element.annId == annIDtoTest)) {
            ++success;
            return true;
        }

        else {
            ++failure;
            testModeFailures.push(failureDumpInfo);
            return false;
        }
    }

    catch {
        noPossibleMatch(failureDumpInfo.filename) 
    }
}


export function noPossibleMatch(filename) {
    testModeFailures.push(filename);
    ++failure;
    return true;
}


export function generateStatistics() {
    let stats = {
        "successes": success,
        "failures": failure,
        "hitRate": (success / (success + failure)),
        "failureList": testModeFailures.map((el) => {
            if (typeof el === "string")
                return el;
            else {
                el.anisongDBannID = el.anisongDBannID.map((song) => song.annId)
            }

            return el;
        })
    }

    fs.writeFileSync("./stats/statsFromLastRun.json", JSON.stringify(stats));
}