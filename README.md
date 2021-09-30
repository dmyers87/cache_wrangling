# Cache Wrangling
## Introduction
An exploration of how to view the MongoDB cache contents and act on what you see

The 'cache' being referred to here is not the query plan cache, but, instead the RAM set aside by the WiredTiger storage engine to cache documents and indexes for faster access. In short, despite the improvements in storage speed over time, RAM is faster than storage.  

The [FAQ MongoDB Diagnostics](https://docs.mongodb.com/manual/faq/diagnostics/) goes into some depth about what the cache is, how to view it, and its function to handle the [working set](https://en.wikipedia.org/wiki/Working_set).  Certainly, MongoDB users ought to be cognizant of how work the DBMS is doing to read data blocks into and evict out of the cache.

If a block MongoDB needs is not in RAM (a cache fault), it has to read it from storage. The more your DBMS is doing that, the slower the overall system performance. This situation is also described as having a working set that is larger than real RAM (as opposed to virtual RAM). As the FAQ states, this is not necessarily something to be concerned about. 

However, it is not clear what to do if you find that your system is overly busy in its cache management. One set of mitigations includes ensuring that queries use indexes and the information model is designed optimally. But, it is still possible, even with optimized queries (and other DB ops), that your system is performing slower than expectations because it's overly busy managing its cache.

What steps would need to be taken to determine what databases, collections, and indexes are being swapped in and out of cache the most often? Knowing this would help to direct your efforts to the parts of your information system that need the most attention. It may not be obvious which queries are slow because of cache faults. The performance of even the most optimal queries/DB ops can be affected by the other, most costly operations.

The work in this repo seeks to explain methods and techniques for using cache metrics to solve performance problems.
## Usage
The initial iteration of the cache wrangler consists of a [cache_report.js](src/mongo_shell/cache_report.js) script designed to be run from the Mongo shell.

To run the cache report, simply connect to the cluster of interest and load the script. By default, the script will report on the current database in use. 

```zsh
Atlas atlas-138n6w-shard-0 [primary] sample_training> load('cache_report.js')
date:		Wed Sep 29 2021 14:27:04 GMT-0500 (Central Daylight Time)

	This MongoDB process uses 72.70% of total cache configured of 256 mb

DB name:	sample_training

           COLL NAME       CACHED      %           INDEX NAME       CACHED      % 
              grades     25.73 mb  13.83                 _id_       421  b lt .01
              routes    83,940  b   0.04                 _id_      1.46 mb   0.78
         inspections       481  b lt .01                 _id_       421  b lt .01
               posts    13,914  b lt .01                 _id_       227  b lt .01
               trips     7,561  b lt .01                 _id_    12,173  b lt .01
           companies       395  b lt .01                 _id_       887  b lt .01
                zips    11,789  b lt .01                 _id_    43,505  b   0.02
---------------------------------------------------------------------------------
                         25.84 mb                                  1.52 mb       

	"sample_training" database uses:
	* 61.19% of total cache used of 186.11 mb for collections
	* 10.26% of total cache used of 186.11 mb for indexes
	* 10.69% of total cache configured of 256 mb
	* 113.87 mb for collections uncompressed
	* 19.1 mb for indexes
```
Once the script is loaded, you can execute the `cacheReport()` against 'all' databases or a specified database, for example:

```zsh
Atlas atlas-138n6w-shard-0 [primary] sample-airbnb> cacheReport('sample_airbnb')
date:		Wed Sep 29 2021 14:26:09 GMT-0500 (Central Daylight Time)

	This MongoDB process uses 72.70% of total cache configured of 256 mb

DB name:	sample_airbnb

           COLL NAME       CACHED      %           INDEX NAME       CACHED      % 
  listingsAndReviews     97.62 mb  52.45                 _id_     2,765  b lt .01
                   -                     property_type_1_r...    89,348  b   0.05
                   -                                   name_1   294,179  b   0.15
                   -                     address.location_...    32,019  b   0.02
---------------------------------------------------------------------------------
                         97.62 mb                               418,311  b       

	"sample_airbnb" database uses:
	* 48.35% of total cache used of 186.11 mb for collections
	* 0.30% of total cache used of 186.11 mb for indexes
	* 38.29% of total cache configured of 256 mb
	* 89.99 mb for collections uncompressed
	* 589,824 b for indexes

```
## Interpreting the Results
Cached collection documents are not compressed.

Indexes are cached using index prefix compression

The cached size for a database can be compared to the total collection and indexes sizes.
It is possible for the cached capacity to be slightly larger than the total collection and index capacity.

The name of the collection and index is truncated to fit. 

The report specifies cache usage by database collection, including the collection's associated indexes.
The percentage that the collection or index is used of the available cache is also displayed on each line.
For the `sample_airbnb` database above, the collection is consuming `97.6 mb` or `48.35%` of the available cache. 
The indexes consume about another `418,311 b` or `0.30%` of the available cache. 
One can compare the total collections and indexes for the database to see how much of the collections and indexes are cached.   

You'll also find the total cache consumed by all databases in the cluster at the top of the report. In the report above, the cluster is consuming `72.7%` of the `256 mb` of configured cache.

**A Note About Configured Cache**

It is generally recommended you stick with the cache configuration defaults as there's a delicate balancing act in play between the operating system cache and the MongoDB WiredTiger cache. To learn more see [WiredTiger and Memory Use](https://docs.mongodb.com/manual/core/wiredtiger/#memory-use}). For Atlas, the configution can not be changed. See [Atlas Memory](https://docs.atlas.mongodb.com/sizing-tier-selection/#memory) for details.

---
## Persisting the Results
Additionally, the report can persist its findings back to MongoDB. To persist back to the source cluster, set a variable to a database in which you'd like to persist the results. For example:

```
let cacheDB = db.getSiblingDB("dba")
```
If you don't want to contaminate your source cluster with the results data, set the variable to a database in anothter cluster. For example:

```
let cacheDB = connect("mongodb+srv://*****:*****@cachehistory.mnp7x.mongodb.net/dba)
```

Once the `cacheDB` variable is set, pass it as a parameter to the writeCacheReport() function:
```zsh
writeCacheReport(cacheDB)
```
The `writeCacheReport()` function writes to a `cache_report_history` collection in the set cache datbase. A document is created for each database in the cluster, with the following structure:
```json
db.cache_usage_history.findOne()
{
  _id: ObjectId("6154782abc6d903af09a0c4f"),
  systemInfo: {
    currentTime: ISODate("2021-09-29T14:28:57.874Z"),
    hostname: 'atlas-138n6w-shard-00-02.mnp7x.mongodb.net',
    cpuAddrSize: 64,
    memSizeMB: 1695,
    memLimitMB: 1695,
    numCores: 1,
    cpuArch: 'x86_64',
    numaEnabled: false
  },
  database: 'sample_airbnb',
  total_db_collection_size: 94362191,
  total_db_index_size: 544768,
  total_cache_used: 144491407,
  total_cache_configured: 268435456,
  collections: [
    {
      collection_name: 'listingsAndReviews',
      collection_cached_bytes: 102340120,
      indexes: [
        { index_name: '_id_', index_cached_bytes: 1302 },
        {
          index_name: 'property_type_1_room_type_1_beds_1',
          index_cached_bytes: 34256
        },
        { index_name: 'name_1', index_cached_bytes: 290961 },
        {
          index_name: 'address.location_2dsphere',
          index_cached_bytes: 29750
        }
      ],
      total_collection_cache_usage: 102696389,
      collection_cache_usage_percent: 71.0743919878917
    }
  ],
  cache_reading_id: ObjectId("61547829bc6d903af09a0c4e") }
}
  ```
### Reporting on the persisted results
We can use the persisted cache report to summarize the cache usage.

Using the database where the "cache_usage_history" documents are written, the [report_top_five_cache_usages.js](src/mongo_shell/report_top_five_cache_usages.js)
script reports on the top five most cached collections.

```zsh
Top Five Cache Usages
date: Thu Sep 30 2021 11:38:12 GMT-0500 (CDT)
 
             DB NAME            COLL NAME       CACHED      % MAX POSSIBLE 
       sample_airbnb   listingsAndReviews     97.96 mb  98.81     90.55 mb
        sample_mflix               movies   559,303  b   0.54     49.74 mb
     sample_training                 zips    92,990  b   0.09      4.95 mb
     sample_training            companies    37,696  b   0.04     34.89 mb
     sample_training                trips    36,414  b   0.04      4.73 mb
```
This report lists the collections with the top cache usages, with cache size used, the percent of the available
cache used, and the max possible cache used if all the collections documents and indexes where cached. 
Note that it is possible that the cached used by the collection may be larger than total size of the documents and indexes.
