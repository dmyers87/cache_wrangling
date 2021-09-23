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
date:		Thu Sep 23 2021 09:22:27 GMT-0400 (Eastern Daylight Time)
DB name:	sample_training

           COLL NAME       CACHED      %           INDEX NAME       CACHED      %
              grades     25.72 mb  14.18                 _id_       421  b lt .01
              routes       397  b lt .01                 _id_       420  b lt .01
         inspections       481  b lt .01                 _id_       421  b lt .01
               posts    13,914  b lt .01                 _id_       227  b lt .01
               trips    13,088  b lt .01                 _id_    16,479  b lt .01
           companies       395  b lt .01                 _id_       697  b lt .01
                zips     4,594  b lt .01                 _id_    35,244  b   0.02

	Uses 14.23% of total cache of 181.39 mb
```
Once the script is loaded, you can execute the `cacheReport()` against 'all' databases or a specified database, for example:

```zsh
Atlas atlas-138n6w-shard-0 [primary] sample-airbnb> cacheReport('sample_airbnb')
date:		Thu Sep 23 2021 09:23:10 GMT-0400 (Eastern Daylight Time)
DB name:	sample_airbnb

           COLL NAME       CACHED      %           INDEX NAME       CACHED      %
  listingsAndReviews      97.6 mb  53.81                 _id_   130,041  b   0.07
                   -                     property_type_1_r...    92,035  b   0.05
                   -                                   name_1     1,488  b lt .01
                   -                     address.location_...    56,855  b   0.03

	Uses 53.95% of total cache of 181.39 mb
```
## Interpreting the Results
The report specifies cache usage by database collection, including the collection's associated indexes. For the `sample_airbnb` database above, the collection is consuming `97.6 mb` or `53.81%` of the available cache. The indexes consume about another `0.25 mb` of cache for a total `53.95%` of cache consumed by this database.

