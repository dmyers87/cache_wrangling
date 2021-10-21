// Steve Hand 2021-OCT-11
// List hottest collections
//    Roughly based on hottest collections solution from Compass
//    https://github.com/mongodb-js/compass-serverstats/blob/master/src/stores/top-store.js#L86

load('utils.js');

/**
 * Get the hottest collection report object
 * Watch "top" command results for hot collections
 * @param minutesToWatch, minutes to watch for changes
 * @param waitSecsBetweenTopFetch, pauses between looking for new collections
 * @return {*[]}
 */
function getHottestCollectionsObj(minutesToWatch=1, waitSecsBetweenTopFetch = 5) {
    assert(typeof minutesToWatch === "number", 'minutesToWatch arg must be number');
    assert(typeof waitSecsBetweenTopFetch === "number", 'waitSecsBetweenTopFetch arg must be number');

    let hottestCollectionReport = new Object();
    hottestCollectionReport.systemInfo = db.hostInfo().system;

    hottestCollectionReport.watchMinutes = minutesToWatch;

    const num_cores = db.hostInfo().system.numCores;
    const cadence = 1000000 * minutesToWatch * 60 // Can safely assume we're polling 1x/sec TODO

    process.stdout.write(`Watching for hot collections for ${minutesToWatch} minutes: `);

    const stopDate = new Date(new Date().getTime() + (minutesToWatch * 60 * 1000));
    const topCollsFirst = db.getSiblingDB("admin").runCommand("top").totals;

    let hottestCollections = [];
    let i = 0;
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
            const loadPercent = ((totalTimeDiff * 100) / (cadence * num_cores)).toFixed(2); // System load.
            if(loadPercent > 0) {
                hottestCollections.push({
                        'collectionName': collName,
                        'loadPercent': loadPercent,
                        'readLoadPercent': readLoadPercent,
                        'writeLoadPercent': writeLoadPercent
                    }
                )
            }
        }
    }
    // Sort
    hottestCollections.sort(function(a, b) {
        const f = (b.loadPercent < a.loadPercent) ? -1 : 0;
        return (a.loadPercent < b.loadPercent) ? 1 : f;
    });

    hottestCollectionReport.hot_collections = hottestCollections;

    return hottestCollectionReport;
}

/**
 * Print the hottest collection report
 * @param minutesToWatch, minutes to watch for changes
 * @param waitSecsBetweenTopFetch, pauses between looking for new collections
 */
function printHottestCollReport(minutesToWatch=1, waitSecsBetweenTopFetch = 5) {
    print();
    const dt = Date();
    const topCollReport = getHottestCollectionsObj(minutesToWatch, waitSecsBetweenTopFetch);
    const topColl = topCollReport.hot_collections;

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
    for(rpt of topColl) {
        print(pad(collNameSize, rpt.collectionName, padLeft=false) + ' '
            + pad(loadPercentSize, rpt.loadPercent) + ' '
            + pad(readLoadPercentSize, rpt.readLoadPercent) + ' '
            + pad(writeLoadPercentSize, rpt.writeLoadPercent) + ' ');
    }
}

/**
 * Writes hottestCollectionsReport objects to the 'hottest_collection_history' collection in the specified database
 * @param dbase, a database reference, albeit local or remote
 * @param minutesToWatch, minutes to watch for changes
 * @param waitSecsBetweenTopFetch, pauses between looking for new collections
 * Ex:
 *   dba_db = connect("mongodb+srv://<un>>:<pw>@<cluster FQDN>/<target DB>>")
 *   writeHottestCollectionsReport(dba_db)
 * All hottest collections readings produced by this method have the same hot_collections_reading_id
 */
function writeHottestCollectionsReport(dbase, minutesToWatch=1, waitSecsBetweenTopFetch = 5)  {
    const hotCollRptColl = 'hottest_collection_history';
    print("Sending cache report for:");
    const readingId = new ObjectId();
    // create index on readings
    dbase[hotCollRptColl].createIndex({hot_collections_reading_id: 1});
    // write hottest collection reports
    let hcr = getHottestCollectionsObj(minutesToWatch, waitSecsBetweenTopFetch);
    // enable grouping cache reports by readingId
    hcr.hot_collections_reading_id = readingId;
    try {
        dbase[hotCollRptColl].insertOne(hcr);
    }
    catch(e) {
        if(e instanceof TypeError) {
            print('verify that the "dbname" argument is a database object');
        }
        else {
            throw e;
        }
    }
}

// main
print("run 'printHottestCollReport()` passing minutes to run");
print();
print("To write the hottest collection report to a database:");
print("\texecute: ");
print("\t\t// Setup a connection URI to the destination of cache reports, including target database")
print("\t\tlet cacheDB = connect(<connection URI>)");
print("\t\t// hottest collections documents to be written to 'hottest_collection_history' collection")
print("\t\t'writeHottestCollectionsReport(cacheDB, [minutesToWatch], [waitSecsBetweenTopFetch])' passing a Mongo connection")
print();
