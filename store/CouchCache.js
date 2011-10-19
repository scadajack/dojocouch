define("dojocouch/store/CouchCache", ["dojo"], function(dojo) {
dojo.getObject("store", true, dojo);

dojo.require("dojo.store.Cache");

/*=====
dojo.declare("dojo.store.__CacheArgs", null, {
	constructor: function(){
		// summary:
		//		These are additional options for how caching is handled.
		// isLoaded: Function?
		//		This is a function that will be called for each item in a query response to determine
		//		if it is cacheable. If isLoaded returns true, the item will be cached, otherwise it
		//		will not be cached. If isLoaded is not provided, all items will be cached.
		this.isLoaded = isLoaded;
	}
});
=====*/
dojocouch.store.CouchCache = function(masterStore, cachingStore, /*dojo.store.__CacheArgs*/ options){
	// summary:
	//		The Cache store wrapper takes a master store and a caching store,
	//		caches data from the master into the caching store for faster
	//		lookup. Normally one would use a memory store for the caching
	//		store and a server store like JsonRest for the master store.
	// masterStore:
	//		This is the authoritative store, all uncached requests or non-safe requests will
	//		be made against this store.
	// cachingStore:
	//		This is the caching store that will be used to store responses for quick access.
	//		Typically this should be a local store.
	// options:
	//		These are additional options for how caching is handled.
	var cache = dojo.store.Cache(masterStore,cachingStore,options);
	cache.bulkGet = function(idArray){
		var getArray = [];
		var objHash = {};

		var getArray = dojo.map(idArray,function(item){
			var val = cachingStore.get(item);
			val ? objHash[item] = val : getArray.push(item);
		});

		return masterStore.bulkGet(getArray)
			.then(
				function(results){
						// put all results back into objHash
					dojo.forEach(results,function(item){
						objHash[item["_id"]] = item;
					});

						// now, using idArray, put the results into 
						// the result array in the same order as specified.
					return dojo.map(idArray,function(item){
							return objHash(item);			
					});
				}
			)
	}

	return cache;
}

return dojocouch.store.CouchCache;
});
