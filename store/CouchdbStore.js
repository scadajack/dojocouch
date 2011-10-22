dojo.provide("dojocouch.store.CouchdbStore");

dojo.require("dojocouch.util.Couch");

dojocouch.store.CouchdbStore.getStore = function(options){
	return new dojocouch.store._CouchdbStore(options);
}

dojo.declare("dojocouch.store._CouchdbStore", null, {
	constructor: function(/*dojocouch.store.CouchdbStore*/ options){
		// summary:
		//		This is a basic store for RESTful communicating with a server through JSON
		//		formatted data.
		// options:
		//		This provides any configuration information that will be mixed into the store
		dojo.mixin(this, options);
		//itemWrapper = dojocouch.store.CouchItem.wrapper(this);
		this.init();
	},
	// target: String
	//		The target base URL to use for all requests to the server. This string will be
	// 	prepended to the id to generate the URL (relative or absolute) for requests
	// 	sent to the server
	target: "",
	// idProperty: String
	//		Indicates the property to use as the identity property. The values of this
	//		property should be unique.
	//		Couchdb uses _id by default.
	idProperty: "_id",
	// couch : dojocouch.util.Couch instance
	//
	//
	couch : '',
	// db : a couch.db instance that points to the specific database in the couch.
	//
	//
	db : '',
	//
	// initialized : boolean
	// set when configured with a couch and a database
	initialized : false,

	
	// Holds a reference to the cache wrapper object. See comments on CouchCache for more info.
	cacheWrapper: null,
	//
	// views: Holds a list of views defined in the default design document for this db.
	// 		(the default design document has the same name as the database.)
	views : '',



	init: function(options){
		options && dojo.mixin(this.options);
		this.setCouch(this.target);
		this.setDb(this.dbName);
		
	},

	setCouch : function(couch){
		if (couch && couch.session){
			this.couch = couch;
		} else if (couch && typeof couch == "string") {
			this.couch = dojocouch.util.Couch.getCouch(this.target);
		} else {
			console.error("setCouch must be called with either a dojocouch.util.Couch instance or a "
					+ "string url");
		}
		initialized = this.couch && this.db;
	},

	setDb : function(dbName){
		if (this.couch && dbName){
			this.db = this.couch.db(dbName);
		}
		initialized = this.couch && this.db;
	},

	get: function(idOrObj, options){
		//	summary:
		//		Retrieves an object by its identity or refreshes and existing object.
		//      This will trigger a GET request to the server using
		//		the url `this.target + id`.
		//	id: Number
		//		The identity to use to lookup the object
		//	returns: Object
		//		The object in the store that matches the given id.
		if (initialized){
			return this.db.openDoc(idOrObj,options)
			.then(
				function(result){
					//return this.itemWrapper._wrap(result);
					return result; // not implementing itemWrapper right now.
				}
			);
		} else {
			this.unitializedRequest('get');
		}

/*
		var headers = options || {};
		headers.Accept = "application/javascript, application/json";
		return dojo.xhrGet({
			url:this.target + id,
			handleAs: "json",
			headers: headers
		});
*/
	},

	

	getIdentity: function(object){
		// summary:
		//		Returns an object's identity
		// object: Object
		//		The object to get the identity from
		//	returns: Number
		return object[this.idProperty];
	},
	put: function(object, options){
		// summary:
		//		Stores an object. This will trigger a PUT request to the server
		//		if the object has an id, otherwise it will trigger a POST request.
		// object: Object
		//		The object to store.
		// options: dojo.store.api.Store.PutDirectives?
		//		Additional metadata for storing the data.  Includes an "id"
		//		property if a specific id is to be used.
		//	returns: Number
		options = options || {};
		
		
		if (initialized){
			var res;
			// if object hasn't been loaded, we need to load it first in case a stub got modified.
			// Must check to see that an id is present, otherwise, it is a new object that needs 
			// to be saved and we don't want to do this.
			if (object[this.idProperty] && typeof object.load == "function"){
				return dojo.when(this.get(object[this.idProperty]),
					function(result){
						result = dojo.mixin(result,object); // use supplied values to override loaded ones.
						return this.put(result,options);	// then load.
					}
				);
			} 
			return this.db.saveDoc(object,options)
				.then(
					// on success, couch.js should have updated id and rev for us.
					// but the server may adjust values on save, so if refresh updates 
					// is set, we'll reload the value from the database.
					function(result){
						if (options.refreshUpdates){
							return this.get(result.id);
						} else {
							return result;
						}
					}
				);
				// FIXME! Need to update doc after saving incl id & rev.
		} else {
			this.unitializedRequest('put');
		}

/*		
		var id = ("id" in options) ? options.id : this.getIdentity(object);
		var hasId = typeof id != "undefined";
		return dojo.xhr(hasId && !options.incremental ? "PUT" : "POST", {
				url: hasId ? this.target + id : this.target,
				postData: dojo.toJson(object),
				handleAs: "json",
				headers:{
					"Content-Type": "application/json",
					"If-Match": options.overwrite === true ? "*" : null,
					"If-None-Match": options.overwrite === false ? "*" : null
				}
			});
*/
	},
	add: function(object, options){
		// summary:
		//		Adds an object. This will trigger a PUT request to the server
		//		if the object has an id, otherwise it will trigger a POST request.
		// object: Object
		//		The object to store.
		// options: dojo.store.api.Store.PutDirectives?
		//		Additional metadata for storing the data.  Includes an "id"
		//		property if a specific id is to be used.
		options = options || {};
		//options.overwrite = false;
		return this.put(object, options);
	},
	remove: function(idOrObj){
		// summary:
		//		Deletes an object by its identity or by object. This will trigger a DELETE request to the server.
		//		Note: api has remove by id only. But couchdb wants a rev also before it will 
		//		delete. So I've added the possiblity to take an object (that presumably has 
			//	the rev to avoid a call to the db.)
		// id: Number
		//		The identity to use to delete the object
		if (initialized){
				// if we don't have an item supplied to remove, see if we can get one
				// Note we don't care if it is loaded or not because all we need is an
				// id and rev to remove.
			if (!idOrObj.isItem || !idOrObj.isItem()){
				return this.get(idOrObj)
					.then(
						function(result){
							// make sure we've got an item now to avoid stack ovfl
							if (result.isItem && result.isItem()){
								return this.remove(result);
							} else {
								this.invalidRequest("Cannot find item to remove from parameter:",idOrObj);	
							}
						});
			} else {
				return this.remove(result);
			}
		} else {
			this.unitializedRequest('put');
		}
	},

	bulkGet: function(idArray){
		console.log("============>  dojocouch.store.CouchdbStore bulkGet called with idArray:",idArray);
		if (initialized){
			return this.db.allDocs({keys:idArray,"include_docs":true});
		} else {
			this.unitializedRequest("bulkGet");
		}
	},

	query: function(query, options){
		// summary:
		//		Queries the store for objects. This will trigger a GET request to the server, with the
		//		query added as a query string.
		// query: Object
		//		The query to use for retrieving objects from the store.
		// options: dojo.store.api.Store.QueryOptions?
		//		The optional arguments to apply to the resultset.
		//	returns: dojo.store.api.Store.QueryResults
		//		The results of the query, extended with iterative methods.
		// 
		// Couchdb doesn't natively have arbitrary native queries out of the box.
		// So there are three query mechanisms at this time:
		// 1. {_query : 'docs',
		// 		startkey : startkey,
		// 		endkey : endkey,
		// 		keys	: [key,...]}
		// 
		// 2. {_query : 'view',
		// 		view : (see view spec below.)}
		// 
		// 3. {_query : 'temp',
		// 		map  : map function or function string,
		// 		reduce : reduce function or function string}
		//
		// 4. { fieldName : selector,
		//		params : query paramters} 
		//		see impliedView spec
		// 
		// view spec:
		// 		Standard view api with some twists:
		// 		view: the url of a view or a named view. View url's  
		// 		use a special coding.
		//		- a/b: interpreted as db/_design/a/_view/b
		// 		- a --> db/_design/db/_view/a or a supplied named view
		// 		- /a --> absolute url relative only to the database
		// 
		// Additional parameters: Additional parameters may be added to query as noted 
		// 		in couchdb api.
		// 
		// impliedView spec:
		// 		Standard view where view is implied by the fieldName. Will attempt a query 
		//		on a field 'by' + fieldName (where field name is capitalized.)
		//		Will error if view does not exist. The params field is used to hold any 
		//		couchdb parameters (in the other queries, these are held in the top level 
		// 		object itself.)
		// 
		// 		
		//
		//
		// NOTE: query parameter is for providing query arguments. Options parameter is 
		// 		for modifying the returned result set.
		// 
		// 		This function however, uses the 'start' and 'count' fields from the options 
		// 			and puts them in the query as 'skip' and 'count' if the parameter 
		// 			options.pageOnServer is set.

		// summary:
		//		Queries the store for objects. This will trigger a GET request to the server, with the
		//		query added as a query string.
		// query: Object
		//		The query to use for retrieving objects from the store.
		// options: dojo.store.api.Store.QueryOptions?
		//		The optional arguments to apply to the resultset.
		//	returns: dojo.store.api.Store.QueryResults
		//		The results of the query, extended with iterative methods.
		console.log("CouchdbStore",this,", query called with Query:",query,", Options:",options);
		if (typeof query == "function"){
			console.error("Invalid query. This store does not support function queries.");
		}
		var headers = {Accept: "application/javascript, application/json"};
		var ourOptions = dojo.mixin({},options || {});
		query = dojo.mixin({},query); // clone query so we don't modify original object.

		// make sure to convert any RegExp values to strings. Some mechanisms, the DataGrid 
		// in particular, translate string values to RegExp's.
		for (var k in query){
			if (query[k] instanceof RegExp){
				query[k] = query[k].toString();
			}
		}
		
		if(ourOptions.pageOnServer && (ourOptions.start >= 0 || ourOptions.count >= 0)){
			headers.Range = "items=" + (ourOptions.start || '0') + '-' +
				(("count" in ourOptions && ourOptions.count != Infinity) ?
					(ourOptions.count + (ourOptions.start || 0) - 1) : '');
			// couchdb uses skip instead of count in the query itself. 
			// Though it is better to use startkey instead of skip 
			// but that's an optimization done later. Also, if we're going to do this 
			// server side, we need to put skip and count in the query object
			!query.skip && ourOptions.start 
				&& (query.skip = ourOptions.start) && (delete ourOptions.start);
			!query.count && ourOptions.count 
				&& (query.count = ourOptions.count) && (delete ourOptions.count);
		}

			// NOTE: Some mechanisms will translate the _query to a RegExp, so 
			// we just make sure it is a string before proceeding.
		var mq = (query._query || 'impliedView').toString();
		var qfunc;
		delete query._query;
		switch (mq){
			case 'docs' : qfunc = this.docsQuery;  break;
			case 'view' : qfunc = this.viewsQuery; break;
			case 'temp' : qfunc = this.tempQuery;  break;
			case 'impliedView' : qfunc = this.impliedViewQuery; break;
			default		: this.invalidRequest("No query specified. Aborting"); return;
		}

		var queryErrorFunction = function(result){
			console.log("CouchdbStore Query produced Error. Result:",result);
			return result;
		}

		var ids = [];
		var docs = {};
		var self = this;
		var results = qfunc.call(this,query,ourOptions);
		var qryResults = results
			.then(function(results){
					// resolve any stubs in array. Since we're doing this here,
					// we should just "include_docs" if view doesn't return 
					// rows natively as it would save another call. But in 
					// case, we process for getting stub values.
					// we have to pull the values out of the results anyway, so 
					// it's not too expensive.
				var stubs = [];
				var rows = results.rows
				if (rows){
					for (var row in rows){
						var id = rows[row].id;
						ids.push(id);
							// Originally had || rows[row].value but removed. There is no 
							// assurance that value is the full data record. May create flag 
							// later to use this for queries that provide full record in data.
						var docValue = rows[row].doc;  //|| rows[row].value;
						docValue && docValue["_id"] && (docs[id] = docValue);
						!(docValue && docValue["_id"]) && stubs.push(id);
					}
				}
				if (stubs && stubs.length > 0){
					if (self.cacheWrapper)
						return self.cacheWrapper.bulkGet(stubs);
					else 
						return self.bulkGet(stubs)
							.then(function(bulkResult){
									// Want to return an actual array of docs here. So extract docs.
								if (bulkResult && bulkResult.rows){
									return dojo.map(bulkResult.rows,function(item){
										return item.doc;
									});
								} else {
									return [];
								}
							});
				} else {
					return docs;
				}
			})
			.then(function(result){
				
				// Doublecheck here: Shouldn't be getting full result here. Should have only array of rows 
				// returned. However, if I missed something, try to fix and log an error so we can fix.	
				if (result && result.rows){
					console.error("CouchdbStore error ln 390 ==> Result should be array and should not have 'rows' field!");
					result = result.rows;
				}

				// Check and see if we had to fetch records for stubs in the query.
				// If so, stuff the docs array with the records fetched. (Otherwise, 
				// the query itself had the documents and docs already has the records.)
				if (result !== docs && result){
					dojo.forEach(result,function(item){
						docs[item["_id"]] = item;
					});
				}
				var resArray = [];
				resArray = dojo.map(ids,function(id){
					return docs[id];
				})
				//console.log("CouchdbStore resArray ln 392 ==>",resArray);
				return self.queryResultProcessor(resArray,options);
			}, queryErrorFunction);


			// If no error, then add total, offset, and rows to results.
			// (results.results == [successful result, error result]),
			// so if results.results[1] is defined, it indicates an error.
		//results.results = {
		qryResults.results = {
			total : results.then(function(resp){
						return resp["total_rows"];
				}, function(){})

			, offset : results.then(function(resp){
				return resp.offset;
				}, function(){}	)

			, rows : results.then(function(resp){
				return resp.rows;
				}, function(){})
		}

		return dojo.store.util.QueryResults(qryResults);


	},

	queryResultProcessor : function(results,options){
		// next we sort
		if(options && options.sort){
			results.sort(function(a, b){
				for(var sort, i=0; sort = options.sort[i]; i++){
					var aValue = a[sort.attribute];
					var bValue = b[sort.attribute];
					if (aValue != bValue) {
						return !!sort.descending == aValue > bValue ? -1 : 1;
					}
				}
				return 0;
			});
		}
		// now we paginate
		if(options && (options.start || options.count)){
			var total = results.length;
			results = results.slice(options.start || 0, (options.start || 0) + (options.count || Infinity));
			results.total = total;
		}
		return results;
	},

		// this is an allDocs type query with either startkey and endkey or a 
		// key array.
	docsQuery : function(query,options){
		//query["include_docs"] = true; // assume we want docs when we do this query.
		return this.db.allDocs(query);
	},

	// requests a defined query corresponding to the selector parameter.
	// Probably should add 1) look for defined query, proceed if there.
	// else either create temp view to do the query.
	impliedViewQuery : function(query,options){
		var viewParams = query.params || {};
		delete query.params;
		var qryName = '';
		for (var k in query){
			if (k){
				qryName = k;
				break;
			}
		}
		var origKeyValue = k;
		
		var self = this;

		var fallbackToTempView = options && options.fallbackToTempView;
		options && (delete options.fallbackToTempView);

		if (!origKeyValue){
			console.log("CouchdbStore called with invalid impliedViewQuery. Query:",query,
						"Options:",options);
		}

		return dojo.when(this.getDefinedViews(),function(views){
				// capitalize the query parameter name and prepend with 'by', so typeId -> byTypeId
			var searchView = origKeyValue && ("by" + origKeyValue.charAt(0).toUpperCase() + origKeyValue.slice(1));
			if (views && views.indexOf(searchView) > -1 ){
				viewParams.view = searchView;
				viewParams.key = query[origKeyValue];
				return self.viewsQuery(viewParams,options);		
			} else if (fallbackToTempView){
				// if no view exists, do tempQuery and log a warning message
				console.warn("Do not find a view for",searchView,", Creating a temp view to perform query",
					"this is very inefficient. A view should be defined to handle this query.");
				viewParams.map = "function(doc){emit(doc['" + origKeyValue + "'],null)}";
				viewParams.key = query[origKeyValue];
				return self.tempQuery(viewParams,options);	
			} else {
				console.warn("No view found for",searchView,", aborting query operation.");
				var err = new Error("No view found for",searchView,", aborting query operation.");
					// client is expecting a deferred on return, so satisfy them.
				var df = new dojo.Deferred();
				df.errback(err);
				return df;
			}
		});
	},

	viewsQuery : function(query,options){
		if (!query.view.indexOf('/') > -1){
			query.view = this.db.name + '/' + query.view;
		}

		var qryParam = query.view;
		delete query.view;

		return this.db.view(qryParam,query);
	},

	tempQuery : function(query,options){
		
		delete query.query;
		var map = query.map;
		var reduce = query.reduce;
		delete query.map;
		delete query.reduce;

		return this.db.query(map,reduce,"javascript",query);
	},

	// Pulls defined views out of default design document in database.
	getDefinedViews : function(){
		if (this.views.initialized){
			return this.views;
		}
		var self = this;
		return this.get('_design/' + this.db.name)
			.then( function(result){
				var viewRecords = result.views;
				self.views = [];
				for (var viewName in result.views){
					self.views.push(viewName);
				}
				self.views.initialized = true;
				return self.views;
			}, // on error, just return empty array indicating no veiws to get. 
			function(){return []}
		);
	},

/*	
	query: function(query, options){
		// summary:
		//		Queries the store for objects. This will trigger a GET request to the server, with the
		//		query added as a query string.
		// query: Object
		//		The query to use for retrieving objects from the store.
		// options: dojo.store.api.Store.QueryOptions?
		//		The optional arguments to apply to the resultset.
		//	returns: dojo.store.api.Store.QueryResults
		//		The results of the query, extended with iterative methods.
		var headers = {Accept: "application/javascript, application/json"};
		options = options || {};

		if(options.start >= 0 || options.count >= 0){
			headers.Range = "items=" + (options.start || '0') + '-' +
				(("count" in options && options.count != Infinity) ?
					(options.count + (options.start || 0) - 1) : '');
		}
		if(dojo.isObject(query)){
			query = dojo.objectToQuery(query);
			query = query ? "?" + query: "";
		}
		if(options && options.sort){
			query += (query ? "&" : "?") + "sort(";
			for(var i = 0; i<options.sort.length; i++){
				var sort = options.sort[i];
				query += (i > 0 ? "," : "") + (sort.descending ? '-' : '+') + encodeURIComponent(sort.attribute);
			}
			query += ")";
		}
		var results = dojo.xhrGet({
			url: this.target + (query || ""),
			handleAs: "json",
			headers: headers
		});
		results.total = results.then(function(){
			var range = results.ioArgs.xhr.getResponseHeader("Content-Range");
			return range && (range=range.match(/\/(.*)/)) && +range[1];
		});
		return dojo.store.util.QueryResults(results);
	},
*/
	unitializedRequest : function(method){
		console.error("Cannot call", method, "on CouchdbStore before it is initialized.");
	},

	invalidRequest : function(text){
		console.error("CouchdbStore returned Invalid Request Error ==>",text);
	}
});



