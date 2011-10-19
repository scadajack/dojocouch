dojo.provide("bent.store.couchdbStoreTest");

dojo.require("bent.store.CouchdbStore");
dojo.require("dojo.DeferredList");

var globalTestData = {

	couchOptions : {
				target : '/leaguenet-data',
				dbName : 'testdjcs'
			},
	
	bulkSaveObjects : {data: [
		{name:"first bulk save", message : "I'm first"},
		{name:"second bulk save", message : "I'm second"},
		{name:"third bulk save", message : "I'm third"},
		{name:"fourth bulk save", message : "I'm fourth"},
		{name:"fifth bulk save", message : "I'm fifth"},
	]},

	objectsWithId : []

}

bent.store.couchdbStoreTest = {
	


	execute : function(){
			var options = globalTestData.couchOptions;
			var tester = this;
			var cs = bent.store.CouchdbStore.getStore(options);
			var couch = cs.couch;
			console.log("Couch created with options",options," Now logging in.");
			
			couch.login({name:"couchdb",password:"couchdb"})
			.then(
				function(resp){
					console.log("Logged in and received response:",resp);
					console.log("Now create database if necessary.");
					//return cs.db.info();;
					return couch.allDbs();
				}
			)

			.then( // work off db.info()
				function(resp){ 
					console.log("db.info response: ",resp);
					if (resp && resp.indexOf(options.dbName) == -1){
						console.log("database not present. Creating...");
						return cs.db.create();
					}
					console.log("database found.");
					return resp;
				},function(resp){
					console.log("Error querying database. Continuing in case it works!");
					return resp;
				}
			)
			.then(
				function(resp){
					console.log("Now running tests");
					return tester.runTests(cs); 			
				},function(err){
					console.log("Create Error. Database probably exists. Now running tests.");
					return tester.runTests(cs);
				});
					
	},

	tests : [createDesignDocAndView,putBunchOData,readBunchOData,readView,queryDesignViews,dropDatabase],

	runTests : function(cs){
		var self = this;
		

		var test = this.tests.shift();
		if (test){
			dojo.when(test(cs),function(resp){
				console.log("Test Finished...")
				return self.runTests(cs);
			});
		}
	}
}


function putBunchOData(cs){
		var test = 'putBunchOData';
		console.log("Starting couchdbStoreTest:",test);
		var dl = [];
		dojo.forEach(globalTestData.bulkSaveObjects.data,function(data){
			var d = data;
			dl.push(cs.add(d).then(function(resp){

					d["_id"] = resp && resp.id;
					d["_rev"] = resp && resp.rev;
					globalTestData.objectsWithId.push(d);
					return resp;
				}

			));
		});
		return new dojo.DeferredList(dl);
	}

function readBunchOData(cs){
	var test = 'readBunchOData';
	console.log("Starting couchdbStoreTest:",test);

	var dl = [];
	var ids = dojo.map(globalTestData.objectsWithId,function(data){
		return data["_id"];
	});
	var i = 0;
	dojo.forEach(ids,function(id){
		dl.push(cs.get(id)
		.then(function(resp){
			console.log("read data returned",resp);
			i++;
			return resp;
		})
	)});
	return new dojo.DeferredList(dl);
}

function readView(cs){
	
	var test = "readView";
	console.log("Starting couchdbStoreTest:",test);

	var id1 = globalTestData.objectsWithId[0]["_id"];
	var id2 = globalTestData.objectsWithId[1]["_id"];
	var query = {
		_query : 'docs'
		,startkey : id1<id2 ? id1 : id2
		,endkey : id1>id2 ? id1 : id2
	}

	return cs.query(query,{}).then(
		function(result){
			console.log("readView result:",result);
		}
	)
}

function createDesignDocAndView(cs){
	var test = "createDesignDocAndView";
	console.log("Starting couchdbStoreTest:",test);
	
	// create design document
	var ddoc = {
		"_id" : "_design/" + globalTestData.couchOptions.dbName
		,language : "javascript"
		,views : {
			noKey : {
				map : function(doc){
					emit(doc["_id"],doc);	
				}
			}
			,keyNoValue : {
				map : function(doc){
					emit(doc.name,null);	
				}	
			}
			,keyAndValue : {
				map : function(doc){
					emit(doc.name,doc.message);	
				}	
			}
			,arrayKeyNoValue : {
				map : function(doc){
					emit([doc.name,doc.message],null);	
				}	
			}
			,arrayKeyAndValue : {
				map : function(doc){
					emit([doc.name,doc.message],doc.message);	
				}	
			}
		}
	}

	return cs.put(ddoc)
	.then(function(result){
		console.log("CouchdbStoreTest: ",test,"save design doc returned",result);
		return(cs);
	});
}

function queryDesignViews(cs){
	var test = "queryDesignViews";
	console.log("Starting couchdbStoreTest:",test);
	var qrys = [];
		var qryNames = ['noKey','keyNoValue','keyAndValue','arrayKeyNoValue','arrayKeyAndValue'];
		var qrys = dojo.map(qryNames,function(qry){
			return cs.query({_query:'view',view:qry},{}).
				then(function(result){
					console.log("CouchdbStoreTest ",test,"query for view:",result, 
							"return result ==>",result);
				});
		});
		return new dojo.DeferredList(qrys);	
}

function dropDatabase(cs){
	var test = "drop database";
	console.log("Starting couchdbStoreTest:",test);
	return cs.db.drop()
		.then(function(result){
			console.log("couchdbStoreTest",test,"returned result:",result);
		});
	
}




/*
			var tests = [testGetSession, testUserDb, testLogin
						,testInitDb,testCreateDb
						,testSaveDoc
						,testOpenDoc
						,testBulkSave
						,testQuery
						,testRemoveDoc
						,testBulkRemove
						,testDropDb
						,testLogout		// test logout at end so we have authorization for in between stuff
						];

			var cb = function(){
				var test = tests.shift();
				test && test(cs,cb);
			}

			tests.shift()(cs,cb);	// trigger first test to get things started.
*/	


