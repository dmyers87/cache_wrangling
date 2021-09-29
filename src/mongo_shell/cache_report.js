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
	let padded = "";
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
	// assert(typeof n === "number", 'n arg must be number');
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * @param dbRef database object
 * @param collName collection name
 * @return returns an array object objects
 *    each with indexName and cachedBytes
 */
function getIndexCachedArray(dbRef, collName) {
	let indexCachedArray = [];

	try {
		var	indexStats = dbRef[collName].stats({indexDetails:true});
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
				let bcic = indexStats['indexDetails'][d]['cache']["bytes currently in the cache"]
				indexCachedArray.push({idxName: d, cachedBytes:bcic});
			}
		)
		indexCachedArray.sort(function(a,b) {return a.cachedBytes > b.cachedBytes})
	}
	return indexCachedArray;
}


/**
 * @param dbRef database object
 * @param collName collection name
 * @return returns the size of the collection's cached data
 */
function getCollCached(dbRef, collName) {
	try {
		let stats = dbRef[collName].stats();
		if(typeof stats['wiredTiger'] !== 'undefined') { // may be special collection or a view
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
	let aMB = Math.pow(1024, 2);
	let aGB = Math.pow(1024, 3);
	let rtnNum = "0";
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
	let c = cachedNum / totalCachedNum * 100;
	let rtnStr = "";
	if(c > 0.01) {
		rtnStr = c.toFixed(2).toString();
	}
	else {
		rtnStr = "lt .01";
	}
	return rtnStr;
}

/**
 * Returns a cache report object with all cache details for all collections
 * and all indexes for each collection
 * @param dbName
 * @return cacheReport
 */
function getCacheReportObj(dbName) {
	let cacheReport = new Object();
	cacheReport.systemInfo = db.hostInfo().system;

	cached_db = db.getSiblingDB(dbName);
	cacheReport.database = dbName;

	let totalCacheUsed = cached_db.serverStatus()['wiredTiger']['cache']["bytes currently in the cache"];
	cacheReport.total_cache_used = totalCacheUsed;
	let totalCacheConfig = cached_db.serverStatus()['wiredTiger']['cache']["maximum bytes configured"];
	cacheReport.total_cache_configured = totalCacheConfig;

	let collNames = cached_db.getCollectionNames();
	let collCached = [];
	for(let collName of collNames){
		let cc = getCollCached(cached_db, collName)
		collCached.push({cn: collName, cached: cc});
	}

	collCached.sort(function(a,b) {return a.cached > b.cached});

	let totalCacheDB = 0;
	cacheReport.collections = [];
	for(let x of collCached) {
		let cacheCollection = new Object();
		// append the collection cache fields
		cacheCollection.collection_name = x.cn;
		cacheCollection.collection_cached_bytes = x.cached;
		cacheCollection.indexes = [];

		totalCacheDB += x.cached;

		let indexCached = getIndexCachedArray(cached_db, x.cn);
		// append the index cache elements
		for(let i = 0; i < indexCached.length; i++)	{

			cacheCollection.indexes.push(
				{
					"index_name": indexCached[i].idxName,
					"index_cached_bytes": indexCached[i].cachedBytes
				}
			)
			totalCacheDB += indexCached[i].cachedBytes;
		}
		cacheCollection.total_collection_cache_usage = totalCacheDB
		cacheCollection.collection_cache_usage_percent = totalCacheDB / totalCacheUsed * 100
		cacheReport.collections.push(cacheCollection);
	}

	return cacheReport;
}

/**
 * Produces a cache report of for all collections and indexes in
 * the specified database
 * @param dbName name of database
 * @param printSummary whether to print summary info, default true
 */
function dbCacheReport(dbName, printSummary = true) {
	let collNameSize = 20;
	let collNameHeader = pad(collNameSize, "COLL NAME")
	let collCachedSize = 12;
	let collCachedHeader = pad(collCachedSize, "CACHED")
	let collCachedPercentSize = 6;
	let collCachedPHeader = pad(collCachedPercentSize, "%")
	let indexNameSize = 20
	let indexNameHeader = pad(indexNameSize, "INDEX NAME")
	let indexCachedSize = 12;
	let indexCachedHeader = pad(indexCachedSize, "CACHED")
	let indexCachedPercentSize = 6;
	let indexCachedPHeader = pad(indexCachedPercentSize, "%")

	let cacheReport = getCacheReportObj(dbName);
	let totalCacheUsed = cacheReport.total_cache_used;
	let totalCacheConfig = cacheReport.total_cache_configured;
	let totalCacheUsedDB = 0;
	if(printSummary) {
		print();
		print(`\tThis MongoDB process uses ${cachedPercentString(totalCacheConfig, totalCacheUsed)}% of total cache configured of ${humanReadableNumber(totalCacheConfig)}`);
		print();
	}
	// get cache report
	cached_db = db.getSiblingDB(dbName);
	print(`DB name:\t${cached_db._name}`)
	print();
	print(`${collNameHeader} ${collCachedHeader} ${collCachedPHeader} ${indexNameHeader} ${indexCachedHeader} ${indexCachedPHeader} `);

	let collCached = cacheReport.collections;
	for(let coll of collCached) {
		let indexCached = coll.indexes;
		let indexIdxLen = indexCached.length;
		for(let i = 0; i < indexIdxLen; i++)	{
			if(i === 0) {
				print(pad(collNameSize, coll.collection_name) + ' '
					+ pad(collCachedSize, humanReadableNumber(coll.collection_cached_bytes)) + ' '
					+ pad(collCachedPercentSize, cachedPercentString(totalCacheUsed, coll.collection_cached_bytes)) + ' '
					+ pad(indexNameSize, indexCached[i].index_name) + ' '
					+ pad(indexCachedSize, humanReadableNumber(indexCached[i].index_cached_bytes)) + ' '
					+ pad(indexCachedPercentSize, cachedPercentString(totalCacheUsed, indexCached[i].index_cached_bytes))
				);
				totalCacheUsedDB += coll.collection_cached_bytes;
				totalCacheUsedDB += indexCached[i].index_cached_bytes;
			}
			else {
				print(pad(collNameSize, ' -') + ' '
					+ pad(collCachedSize, ' ') + ' '
					+ pad(collCachedPercentSize, ' ') + ' '
					+ pad(indexNameSize, indexCached[i].index_name) + ' '
					+ pad(indexCachedSize, humanReadableNumber(indexCached[i].index_cached_bytes)) + ' '
					+ pad(indexCachedPercentSize, cachedPercentString(totalCacheUsed, indexCached[i].index_cached_bytes))
				);
				totalCacheUsedDB += indexCached[i].index_cached_bytes;
			}
		}
	}
	print();
	print(`\t"${dbName}" uses ${cachedPercentString(totalCacheUsed, totalCacheUsedDB)}% of total cache used of ${humanReadableNumber(totalCacheUsed)}`);
	print(`\t"${dbName}" uses ${cachedPercentString(totalCacheConfig, totalCacheUsedDB)}% of total cache configured of ${humanReadableNumber(totalCacheConfig)}`);
}


/**
 * produce cache usage report
 * @param scope "current" database or "all" databases
 */
function cacheReport(scope="current") {
	let dt = Date();
	print(`date:\t\t${dt}`);
	switch(scope) {
		case "current":
			var dbName = db._name;
			dbCacheReport(dbName);
			break;

		case "all":
			let firstTime = true;
			let adminDBs = ['admin','config','local'];
			db.adminCommand('listDatabases').databases.forEach(function(d) {
				if(! adminDBs.includes(d.name)){
					dbCacheReport(d.name, firstTime);
					print("**********");
					firstTime = false;
				}
			})
			break;

        case scope:
			var dbName = scope;
			dbCacheReport(dbName);
			break;			

	}
}

/**
 * Writes cacheReport objects to the 'cache_usage_history' collection in the specified database
 * @param dbase, a database reference, albeit local or remote
 * Ex:
 *   dba_db = connect("mongodb+srv://<un>>:<pw>@<cluster FQDN>/<target DB>>")
 *   writeCacheReport(dba_db)
 * All cache readings produced by this method have the same cache_reading_id
 */
function writeCacheReport(dbase) {
	let adminDBs = ['admin','config','local'];
	let cacheDB = 'cache_usage_history';
	print("Sending cache report for:");
	let ctn = true;
	let readingId = new ObjectId();
	db.adminCommand('listDatabases').databases.forEach(function(d) {
		if(! adminDBs.includes(d.name) && ctn){
			print(`\t${d.name} database`);
			// get cache report object
			let cr = getCacheReportObj(d.name);
			// enable grouping cache reports by readingId
			cr.cache_reading_id = readingId;
			try {
				dbase[cacheDB].insertOne(cr);
			}
			catch(e) {
				if(e instanceof TypeError) {
					print('verify that the argument is a database object');
					ctn = false;
				}
				else {
					throw e;
				}
			}
		}
	})
}

// main
print("To print cache report:");
print("\texecute: 'cacheReport()' with 'current' db 'all' DBs or <db name>.");
print();
print("To write the cache report to a database:");
print("\texecute: ");
print("\t\t// Setup a connection URI to the destination of cache reports, including target database")
print("\t\tlet cacheDB = connect(<connection URI>)");
print("\t\t// cache documents to be written to 'cache_usage_history' collection")
print("\t\t'writeCacheReport(cacheDB)' passing a Mongo connection")

