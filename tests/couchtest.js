dojo.provide("bent.couchtest");

dojo.require("bent.Couch");


// Test for bent.Couch, the REST interface for Couchdb.


var globalTestData = {}; // a bag to hold misc test data

var globalTestDefaults = {
	
	bulkSaveObjects : {data: [
		{name:"first bulk save", message : "I'm first"},
		{name:"second bulk save", message : "I'm second"},
		{name:"third bulk save", message : "I'm third"},
		{name:"fourth bulk save", message : "I'm fourth"},
		{name:"fifth bulk save", message : "I'm fifth"},
	]}

}

bent.couchtest = {
		db : undefined

		, execute : function(){
			var couch = bent.Couch.getCouch('/leaguenet-data');
			//couch.urlPrefix = '/leaguenet-data';
			//bent.couch.urlPrefix = '/leaguenet-data';

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
				test && test(couch,cb);
			}

			tests.shift()(couch,cb);	// trigger first test to get things started.
	}
}

function logresponse(type, resp,ioargs){
	console.log("\tTest Results:",type
				,",Response ==>",resp  || "not provided"
				,",\n\tIOArgs ==>",ioargs || "not provided");
}

function logError(type, resp,ioargs){
	console.error("\tTest Results:",type
				,",Response ==>",resp  || "not provided"
				,",\n\tIOArgs ==>",ioargs || "not provided");
}



function testGetSession(couch,cb){
	couch.session({ success : function(resp,ioargs){
							logresponse("Get Session",resp,ioargs);
							cb();
						}
						, error : function(resp,ioargs){
							logError("Get Session Error",resp,ioargs);
							cb();
						}
		});
}

function testUserDb(couch,cb){
	couch.userDb(function(userDb){
							logresponse("Get UserDb",userDb);
							cb();
	});	
}

function testLogin(couch,cb){
	couch.login({ name:'couchdb',password:'couchdb'
						, success : function(resp,ioargs){
								// just look for a role or a name here. One or the other should confirm.
								// The response is a userCtx object
							if (resp.name || resp.roles && resp.roles[0]){
								logresponse("Login Success",resp,ioargs);
							} else {
								logError("Login Error: resp ok but no user name or role returned?",resp,ioargs);
								cb();
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError("Login Error",resp,ioargs);
							cb();
						}
	});
}

function testLogout(couch,cb){
	var testLabel = 'Logout';
	console.log("\nStart Test:",testLabel);
	couch.logout({  success : function(resp,ioargs){
								// just look for a role or a name here. One or the other should confirm.
								// The response is a userCtx object
							if (resp.ok){
								logresponse(testLabel + " Success",resp,ioargs);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
								cb();
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
	});	
}

function testInitDb(couch,cb){
	var testLabel = 'InitDb';
	console.log("\nStart Test:",testLabel);
	var db = couch.db("testdj")
	logresponse( db && (testLabel + " Success") || (testLabel + " Failed"));
	bent.couchtest.db = db;
	setTimeout(cb,200); // just to keep all these methods asynchronous on callback
}

function testCreateDb(couch,cb){
	var testLabel = 'Create db';
	console.log("\nStart Test:",testLabel);
	bent.couchtest.db.create({success : function(resp,ioargs){
								// just look for a role or a name here. One or the other should confirm.
								// The response is a userCtx object
							if (resp.ok){
								logresponse(testLabel + " Success",resp,ioargs);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp || "not Provided"
							,ioargs || "not Provided");
							cb();
						}
					});
}

function testSaveDoc(couch,cb){
	var testLabel = 'Save Doc';
	console.log("\nStart Test:",testLabel);
	var doc = {type : "testType", greeting : "hello"};
	bent.couchtest.db.saveDoc(doc,{success : function(resp,ioargs){
								// just look for a role or a name here. One or the other should confirm.
								// The response is a userCtx object
							if (resp.ok){
								logresponse(testLabel + " Success",resp,ioargs);
								globalTestData.saveDoc = {
										doc : doc
									, 	resp : resp
								}
								console.log("doc is now: ", doc);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});	
}

function testOpenDoc(couch,cb){
	var testLabel = 'Open Doc';
	console.log("\nStart Test:",testLabel);
	var docId = globalTestData.saveDoc && globalTestData.saveDoc.resp.id;
	bent.couchtest.db.openDoc(docId,{success : function(resp,ioargs){
								// just look for a role or a name here. One or the other should confirm.
								// The response is a userCtx object
							if (resp["_id"] == docId){
								logresponse(testLabel + " Success",resp,ioargs);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});	
}

function testBulkSave(couch,cb){
	var testLabel = 'Bulk Save';
	console.log("\nStart Test:",testLabel);
	var saveDocs = globalTestDefaults.bulkSaveObjects.data;
	bent.couchtest.db.bulkSave(saveDocs,{success : function(resp,ioargs){
								// response will be an array of document stubs, [{id:???,rev:???},...]
							if (resp instanceof Array && resp.length == saveDocs.length){
								logresponse(testLabel + " Success",resp,ioargs);
								globalTestDefaults.bulkSaveObjects.response = resp;
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});	
}

function testRemoveDoc(couch,cb){
	var testLabel = 'RemoveDoc';
	console.log("\nStart Test:",testLabel);
	var doc = {
		"_id" : globalTestData.saveDoc && globalTestData.saveDoc.resp.id
		,"_rev" : globalTestData.saveDoc && globalTestData.saveDoc.resp.rev
	}
	bent.couchtest.db.removeDoc(doc,{success : function(resp,ioargs){
								// response will be an array of document stubs, [{id:???,rev:???},...]
							if (resp.ok){
								logresponse(testLabel + " Success",resp,ioargs);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});	
}


function testBulkRemove(couch,cb){
	var testLabel = 'Bulk Remove';
	console.log("\nStart Test:",testLabel);
	var docs = dojo.map(globalTestDefaults.bulkSaveObjects.response,function(doc){
		return {"_id" : doc.id, "_rev" : doc.rev };
	});
	bent.couchtest.db.bulkRemove({docs : docs},{success : function(resp,ioargs){
								// response will be an array of document stubs, [{id:???,rev:???},...]
							if (resp instanceof Array && resp.length == docs.length){
								logresponse(testLabel + " Success",resp,ioargs);
								globalTestDefaults.bulkSaveObjects.response = resp;
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});	
}

function testQuery(couch,cb){
	var testLabel = 'Query';
	console.log("\nStart Test:",testLabel);

	var mapFun = function(doc) {  
		if (doc.name.indexOf('save') > -1) {    
			emit([doc.user,doc.message], doc);  }
	}
/*
	var mapFun = function(doc) {
		  emit(null, doc);
	}
*/	

	var reduceFun = undefined;//"_count"; 
	//function(keys,values){
	//	return sum(values);
	//}

	bent.couchtest.db.query(mapFun,reduceFun,'javascript',{success : function(resp,ioargs){
								// response will be an array of document stubs, [{id:???,rev:???},...]
							if (resp.rows && resp["total_rows"] == 5 && resp.rows instanceof Array){
								logresponse(testLabel + " Success",resp,ioargs);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});	
}


function testDropDb(couch,cb){
	var testLabel = 'Drop db';
	console.log("\nStart Test:",testLabel);
	bent.couchtest.db.drop({success : function(resp,ioargs){
								// just look for a role or a name here. One or the other should confirm.
								// The response is a userCtx object
							if (resp.ok){
								logresponse(testLabel + " Success",resp,ioargs);
							} else {
								logError(testLabel + " Error: ajax returned success function but no 'ok' response provided?",resp,ioargs);
							}

							cb();
						}
						, error : function(resp,ioargs){
							logError(testLabel + " Error",resp,ioargs);
							cb();
						}
					});
}



