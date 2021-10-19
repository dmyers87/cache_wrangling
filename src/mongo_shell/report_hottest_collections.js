// Steve Hand 2021-OCT-11
// List hottest collections
//    Roughly based on hottest collections solution from Compass
//    https://github.com/mongodb-js/compass-serverstats/blob/master/src/stores/top-store.js#L86

load('utils.js');

/**
 * Watch "top" command results for hot collections
 * @param minutesToWatch
 * @param waitSecsBetweenTopFetch
 * @return {*[]}
 */
function hotCollections(minutesToWatch=1, waitSecsBetweenTopFetch = 5) {
    // assert(typeof minutesToWatch === "number", 'minutesToWatch arg must be number');
    // assert(typeof waitSecsBetweenTopFetch === "number", 'waitSecsBetweenTopFetch arg must be number');

    var num_cores = db.hostInfo().system.numCores;
    var cadence = 1000000 * minutesToWatch * 60 // Can safely assume we're polling 1x/sec TODO

    process.stdout.write(`Watching for hot collections for ${minutesToWatch} minutes: `);

    var stopDate = new Date(new Date().getTime() + (minutesToWatch * 60 * 1000));
    var topCollsFirst = db.getSiblingDB("admin").runCommand("top").totals;
    var topCollReport = [];
    var i = 0
    while(new Date() < stopDate) {
        process.stdout.write(".");
        sleep(waitSecsBetweenTopFetch*1000);

        // look for newly added collections
        var topCollsLast = db.getSiblingDB("admin").runCommand("top").totals;
        for(collName of Object.keys(topCollsLast)) {
            if("note" !== collName) {
                var collTopStats = topCollsFirst[collName];
                // if collName isn't in the first results, add it to the first results
                if(collTopStats === 'undefined') {
                    topCollsFirst[collName] = topCollsLast[collName];
                }
            }
        }
    }
    for(collName of Object.keys(topCollsLast)) {
        if ("note" !== collName) {
            var collTopStatsFirst = topCollsFirst[collName];
            var collTopStatsLast = topCollsLast[collName];
            // TODO Should I do an existence check for properties first?
            var totalTimeDiff = collTopStatsLast.total.time - collTopStatsFirst.total.time
            var writeLoadPercent = totalTimeDiff === 0 ? 0 : (((collTopStatsLast.writeLock.time - collTopStatsFirst.writeLock.time) / totalTimeDiff) * 100).toFixed(2);
            var readLoadPercent = totalTimeDiff === 0 ? 0 : (((collTopStatsLast.readLock.time - collTopStatsFirst.readLock.time) / totalTimeDiff) * 100).toFixed(2);
            topCollReport.push({
                'collectionName': collName,
                'loadPercent': ((totalTimeDiff * 100) / (cadence * num_cores)).toFixed(2), // System load.
                'readLoadPercent': readLoadPercent,
                'writeLoadPercent': writeLoadPercent
                }
            )
        }
    }
    // Sort
    topCollReport.sort(function(a, b) {
        const f = (b.loadPercent < a.loadPercent) ? -1 : 0;
        return (a.loadPercent < b.loadPercent) ? 1 : f;
    });
    return topCollReport;
}

function printTHottestCollReport(minutesToWatch=1, waitSecsBetweenTopFetch = 5) {
    print();
    let dt = Date();
    var topCollReport = hotCollections(minutesToWatch, waitSecsBetweenTopFetch);

    // print header
    print();
    print(`date:\t\t${dt}`);
    let collNameSize = 40;
    let collNameHeader = pad(collNameSize, "COLL NAME", padLeft=false)
    let loadPercentSize = 12;
    let loadPercentHeader = pad(loadPercentSize, "LOAD %")
    let readLoadPercentSize = 10;
    let readLoadPercentHeader = pad(readLoadPercentSize, "READS %")
    let writeLoadPercentSize = 10;
    let writeLoadPercentHeader = pad(writeLoadPercentSize, "WRITES %")
    print();
    print(`${collNameHeader} ${loadPercentHeader} ${readLoadPercentHeader} ${writeLoadPercentHeader} `);
    for(rpt of topCollReport) {
        if(rpt.loadPercent > 0) {
            print(pad(collNameSize, rpt.collectionName, padLeft=false) + ' '
                + pad(loadPercentSize, rpt.loadPercent) + ' '
                + pad(readLoadPercentSize, rpt.readLoadPercent) + ' '
                + pad(writeLoadPercentSize, rpt.writeLoadPercent) + ' ');
        }
    }
}

print("run 'printHottestCollReport()` passing minutes to run");
