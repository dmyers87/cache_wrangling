// Steve Hand 2021-SEP-30
// List the top five cache usages

load("cache_report.js")
var cacheColl = "cache_usage_history";

// get last reading
var foundReading = false;
var c = db[cacheColl].find({},{cache_reading_id:1, _id:0}).sort({cache_reading_id:-1}).limit(1)
if(c.hasNext()) {
    var last_reading_id = c.next()
    foundReading = true;
}
else{
    print(`No cache reports found in "${cacheColl}" collection`);
}

if(foundReading) {
    let dbNameSize = 20;
    let dbNameHeader = pad(dbNameSize, "DB NAME")
    let collNameSize = 20;
    let collNameHeader = pad(collNameSize, "COLL NAME")
    let collCachedSize = 12;
    let collCachedHeader = pad(collCachedSize, "CACHED")
    let collCachedPercentSize = 6;
    let collCachedPHeader = pad(collCachedPercentSize, "%")
    let dbIfCachedSize = 12;
    let cdbIfCachedHeader = pad(dbIfCachedSize, "MAX POSSIBLE")
    print(" ");
    print("Top Five Cache Usages");
    print(`date: ${Date()}`);
    print(" ");
    print(`${dbNameHeader} ${collNameHeader} ${collCachedHeader} ${collCachedPHeader} ${cdbIfCachedHeader} `);

    db[cacheColl].aggregate([
        {
            $match: last_reading_id
        },
        {
            $project: {
                "_id": 0,
                "database": 1,
                "total_db_collection_size": 1,
                "total_db_index_size": 1,
                "total_cache_used": 1,
                "collections": 1,
            }
        },
        {
            $unwind: "$collections"
        },
        {
            $project: {
                "database": 1,
                "collection_name": "$collections.collection_name",
                "total_db_collection_size": 1,
                "total_db_index_size": 1,
                "total_db_size_if_cached" : { $add : [ "$collections.collection_size", "$collections.total_index_size" ] },
                "total_collection_cache_usage": "$collections.total_collection_cache_usage",
                "total_collection_cache_usage_percent": "$collections.collection_cache_usage_percent"
            }
        },
        {
            $sort: {
                "total_collection_cache_usage": -1
            }
        },
        {
            $limit: 5
        }
    ]).forEach(
        function (d) {
            print(pad(dbNameSize, d.database) + ' '
                + pad(collNameSize, d.collection_name) + ' '
                + pad(collCachedSize, humanReadableNumber(d.total_collection_cache_usage)) + ' '
                + pad(collCachedPercentSize, d.total_collection_cache_usage_percent.toFixed(2).toString()) + ' '
                + pad(dbIfCachedSize, humanReadableNumber(d.total_db_size_if_cached)));
        }
    );
}