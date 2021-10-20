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

    const num_cores = db.hostInfo().system.numCores;
    const cadence = 1000000 * minutesToWatch * 60 // Can safely assume we're polling 1x/sec TODO

    process.stdout.write(`Watching for hot collections for ${minutesToWatch} minutes: `);

    const stopDate = new Date(new Date().getTime() + (minutesToWatch * 60 * 1000));
    const topCollsFirst = db.getSiblingDB("admin").runCommand("top").totals;

    let topCollReport = [];
    let i = 0
    while(new Date() < stopDate) {
        process.stdout.write(".");
        sleep(waitSecsBetweenTopFetch*1000);

        // look for newly added collections
        var topCollsLast = db.getSiblingDB("admin").runCommand("top").totals;
        for(collName of Object.keys(topCollsLast)) {
            if("note" !== collName) {
                const collTopStats = topCollsFirst[collName];
                // if collName isn't in the first results, add it to the first results
                if(collTopStats === 'undefined') {
                    topCollsFirst[collName] = topCollsLast[collName];
                }
            }
        }
    }
    for(collName of Object.keys(topCollsLast)) {
        if ("note" !== collName) {
            const collTopStatsFirst = topCollsFirst[collName];
            const collTopStatsLast = topCollsLast[collName];
            // TODO Should I do an existence check for properties first?
            const totalTimeDiff = collTopStatsLast.total.time - collTopStatsFirst.total.time
            const writeLoadPercent = totalTimeDiff === 0 ? 0 : (((collTopStatsLast.writeLock.time - collTopStatsFirst.writeLock.time) / totalTimeDiff) * 100).toFixed(2);
            const readLoadPercent = totalTimeDiff === 0 ? 0 : (((collTopStatsLast.readLock.time - collTopStatsFirst.readLock.time) / totalTimeDiff) * 100).toFixed(2);
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

function printHottestCollReport(minutesToWatch=1, waitSecsBetweenTopFetch = 5) {
    print();
    const dt = Date();
    const topCollReport = hotCollections(minutesToWatch, waitSecsBetweenTopFetch);

    // print header
    print();
    print(`date:\t\t${dt}`);
    const collNameSize = 40;
    const collNameHeader = pad(collNameSize, "COLL NAME", padLeft=false)
    const loadPercentSize = 12;
    const loadPercentHeader = pad(loadPercentSize, "LOAD %")
    const readLoadPercentSize = 10;
    const readLoadPercentHeader = pad(readLoadPercentSize, "READS %")
    const writeLoadPercentSize = 10;
    const writeLoadPercentHeader = pad(writeLoadPercentSize, "WRITES %")
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
