// Steve Hand 2021-JUN-02
// Report on the bytes in cache for all collections and indexes in a databases
// HOWTO derived from keyhole
// https://github.com/simagix/keyhole/blob/4eee388b0602dfbf4819909714151ca88f61ed03/mdb/wt_cache.go#L56
//
// See "Memory Diagnostics for Wired Tiger Storage Engine"
// https://docs.mongodb.com/v4.0/faq/diagnostics/#memory-diagnostics-for-the-wiredtiger-storage-engine
// https://docs.mongodb.com/manual/faq/diagnostics/#memory-diagnostics-for-the-wiredtiger-storage-engine
//
// In general,
//  index data is somewhat compressed in the cache (using index prefix compression)
//  collection data is NOT compressed in the cache

/**
 * Right pad the provided string with the specified character
 * @param width
 * @param string
 * @return {*}
 */
function pad(width, string) {
	// assert(typeof width === "number", 'width arg must be number');
	// assert(typeof string === "string", 'string arg must be string');
	var padded = "";
	if(width >= string.length) {
		padded = string.padStart(width);
	}
	else {
		padded = string.substring(0, width - 3) + '...';
	}
	return padded;
}

/**
 * @param n number to format
 * @return formatted string
 */
function niceNum(n) {
	assert(typeof n === "number", 'n arg must be number');
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * @param collName collection name
 * @return returns an array object objects
 *    each with indexName and cachedBytes
 */
function getIndexCachedArray(collName) {
	var indexCachedArray = [];

	try {
		var	indexStats = db[collName].stats({indexDetails:true});
	}
	catch(e) {
		if(e instanceof TypeError) { // may be special collection or a view
		return indexCachedArray;
		}
	}
	// See https://docs.mongodb.com/v4.0/reference/method/db.collection.stats/
	if(typeof indexStats['indexDetails'] !== 'undefined') {
		Object.keys(indexStats.indexSizes).forEach(
			function(d) {
				var bcic = indexStats['indexDetails'][d]['cache']["bytes currently in the cache"]
				indexCachedArray.push({idxName: d, cachedBytes:bcic});
			}
		)
		indexCachedArray.sort(function(a,b) {return a.cachedBytes > b.cachedBytes})
	}
	return indexCachedArray;
}


/**
 * @param collName collection name
 * @return returns the size of the collection's cached data
 */
function getCollCached(collName) {
	try {
		var stats = db[collName].stats();
		if(typeof stats['wiredTiger'] !== 'undefined') {
			return stats['wiredTiger']['cache']["bytes currently in the cache"]
		}
		else {
			return 0
		}
	}
	catch (e) {
		if(e instanceof TypeError) { // may be special collection or a view
			return 0;
		}
		else {
			throw e;
		}
	}
}

/**
 * @param num number that is to be made 'human readable' and formatted
 * @return returns a formatted string
 */
function humanReadableNumber(num) {
	var aMB = Math.pow(1024, 2);
	var aGB = Math.pow(1024, 3);
	var rtnNum = "0";
	if(num > aGB) {
		rtnNum = niceNum(parseFloat((num/aGB).toFixed(2))) + " gb";
	}
	else if(num > aMB) {
		rtnNum = niceNum(parseFloat((num/aMB).toFixed(2))) + " mb";
	}
	else {
		rtnNum = niceNum(num) + "  b";
	}
	return rtnNum;
}

/**
 * @param totalCachedNum total cached data size
 * @param cachedNum collection or index cached data size
 * @return string containing the percent
 */
function cachedPercentString(totalCachedNum, cachedNum) {
	var c = cachedNum / totalCachedNum * 100;
	var rtnStr = "";
	if(c > 0.01) {
		rtnStr = c.toFixed(2).toString();
	}
	else {
		rtnStr = "lt .01";
	}
	return rtnStr;
}

/**
 * Produces a cache report of for all collections and indexes in
 * the specified database
 * @param dbName name of database
 */
function dbCacheReport(dbName) {
	db = db.getSiblingDB(dbName);
	print(`DB name:\t${db._name}`)
	// need clusterMonitor role to get the total size of cache data (serverStatus privilege)
	var totalCacheSize = db.serverStatus()['wiredTiger']['cache']["bytes currently in the cache"];
	print();

	var collNameSize = 20;
	var collNameHeader = pad(collNameSize, "COLL NAME")
	var collCachedSize = 12;
	var collCachedHeader = pad(collCachedSize, "CACHED")
	var collCachedPercentSize = 6;
	var collCachedPHeader = pad(collCachedPercentSize, "%")
	var indexNameSize = 20
	var indexNameHeader = pad(indexNameSize, "INDEX NAME")
	var indexCachedSize = 12;
	var indexCachedHeader = pad(indexCachedSize, "CACHED")
	var indexCachedPercentSize = 6;
	var indexCachedPHeader = pad(indexCachedPercentSize, "%")
	print(`${collNameHeader} ${collCachedHeader} ${collCachedPHeader} ${indexNameHeader} ${indexCachedHeader} ${indexCachedPHeader} `);

	var collNames = db.getCollectionNames();
	var collCached = [];
	for(let collName of collNames){
			var cc = getCollCached(collName)
			collCached.push({cn: collName, cached: cc});
		}

	collCached.sort(function(a,b) {return a.cached > b.cached});
	var totalCachedDBObj = 0;
	for(let x of collCached) {
			var indexCached = getIndexCachedArray(x.cn);
			for(let i = 0; i < indexCached.length; i++)	{
				if(i === 0) {
					print(pad(collNameSize, x.cn) + ' '
					  + pad(collCachedSize, humanReadableNumber(x.cached)) + ' '
						+ pad(collCachedPercentSize, cachedPercentString(totalCacheSize, x.cached)) + ' '
						+ pad(indexNameSize, indexCached[i].idxName) + ' '
						+ pad(indexCachedSize, humanReadableNumber(indexCached[i].cachedBytes)) + ' '
						+ pad(indexCachedPercentSize, cachedPercentString(totalCacheSize, indexCached[i].cachedBytes))
					);
					totalCachedDBObj += x.cached;
					totalCachedDBObj += indexCached[i].cachedBytes;
				}
				else {
					print(pad(collNameSize, ' -') + ' '
						+ pad(collCachedSize, ' ') + ' '
						+ pad(collCachedPercentSize, ' ') + ' '
						+ pad(indexNameSize, indexCached[i].idxName) + ' '
						+ pad(indexCachedSize, humanReadableNumber(indexCached[i].cachedBytes)) + ' '
						+ pad(indexCachedPercentSize, cachedPercentString(totalCacheSize, indexCached[i].cachedBytes))
					);
					totalCachedDBObj += indexCached[i].cachedBytes;
				}
			}
		}
	print();
	print(`\tUses ${cachedPercentString(totalCacheSize, totalCachedDBObj)}% of bytes in cache of ${humanReadableNumber(totalCacheSize)} and ${cachedPercentString(configuredCache, totalCachedDBObj)}% of configured cache of ${humanReadableNumber(configuredCache)}`);

}

/**
 * produce cache usage report
 * @param scope "current" database or "all" databases
 */
function cacheReport(scope="current") {
	var dt = Date();
	print(`date:\t\t\t${dt}`);
	var ram = Math.ceil(db.hostInfo().system.memSizeMB / 1024)
	print(`Host RAM:\t\t${ram} GB`)
	var serverStatus = db.serverStatus();
	configuredCache = serverStatus['wiredTiger']['cache']["maximum bytes configured"];
	print(`Configured Cache:\t${humanReadableNumber(configuredCache)}\n`);
	switch(scope) {
		case "current":
			var dbName = db._name;
			dbCacheReport(dbName);
			break;

		case "all":
			var adminDBs = ['admin','config','local'];
			db.adminCommand('listDatabases').databases.forEach(function(d) {
				if(! adminDBs.includes(d.name)){
					dbCacheReport(d.name);
					print("**********");
				}
			})
			break;

        case scope:
			var dbName = scope;
			dbCacheReport(dbName);
			break;			

	}
}

// main
cacheReport();
