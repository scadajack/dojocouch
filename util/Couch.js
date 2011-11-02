// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

// A REST interface for Couchdb.

// This is a liberal port of the jquery.couch.js library distributed with Couchdb 
// (couchdb.apache.org) to the Dojo framework. In general, the jQuery callback style 
// Ajax code is converted to promise style code used more commonly in Dojo. 
// 
// Structure, method names and intents from the original code are generally 
// preserved. 
// 
// USAGE: var couch = dojocouch.util.Couch.getCouch(urlPrefix),
//        where urlPrefix is a url to the couchdb instance 
//        of interest. Will return a new or cached instance pointing to the couchdb at that 
//        url. (The couch objects are cached and thus shared amongst clients.)
//
//        To get access to database specific operations after obtaining a 'couch', do 
//        var db = couch.db('db name')
//        (while couches are cached, dbs are not).
//        
// AUTHENTICATION: 
//        Provides easy implementation of cookie-based authentication. See Session,Login, and Logout.
//
// This software is preliminary. In particular, the replication and monitoring code has not been 
// tested.
//
//
// For more information regarding this software:
// contact: scadajack@kantrol.com
// 


dojo.provide("dojocouch.util.Couch");

dojocouch.util.Couch.couches = {};

dojocouch.util.Couch.getCouch = function(urlPrefix){
  return dojocouch.util.Couch.couches.urlPrefix || new dojocouch.util._Couch(urlPrefix);
}


dojo.declare("dojocouch.util._Couch", [],{

    constructor : function(urlPrefix){
      this.urlPrefix = urlPrefix;
      dojocouch.util.Couch.couches.urlPrefix = this;
    },

    uuidCache : [],

    urlPrefix: '',
    activeTasks: function(options) {
      return dojocouch.util.Couch.ajax(
        {url: this.urlPrefix + "/_active_tasks"},
        options,
        "Active task status could not be retrieved"
      );
    },

    allDbs: function(options) {
      return dojocouch.util.Couch.ajax(
        {url: this.urlPrefix + "/_all_dbs"},
        options,
        "An error occurred retrieving the list of all databases"
      );
    },

    config: function(options, section, option, value) {
      var req = {url: this.urlPrefix + "/_config/"};
      if (section) {
        req.url += encodeURIComponent(section) + "/";
        if (option) {
          req.url += encodeURIComponent(option);
        }
      }
      if (value === null) {
        req.type = "DELETE";        
      } else if (value !== undefined) {
        req.type = "PUT";
        req.data = dojocouch.util.Couch.toJSON(value);
        req.contentType = "application/json";
        req.processData = false
      }

      return dojocouch.util.Couch.ajax(req, options,
        "An error occurred retrieving/updating the server configuration"
      );
    },
    
    session: function(options) {
      options = options || {};

      return dojo.xhr("GET",{url:this.urlPrefix + "/_session"
        , preventCache : true // noCache true by default (IE has problem with caching on session GET)
        , handleAs : "json"
        , load : function(response,ioargs){
            var respStatus = ioargs.xhr.status;
            if (respStatus == 200){
              if (options.success) {
                options.success(response);
                console.error("success called ln 87");
              }
            } else {
              console.log("Server reported Error getting session info. Response Status ==> ",respStatus,
                  " Response ==>",response, ", IOArgs ==>", ioargs);
            }
            return response;
          }
        , error : function (response, ioargs){
            console.log("Ajax error get session info. Response ==> ", response, ", IOArgs ==> ", ioargs);
            return response;
        }

      });
    },

    userDb : function(callback) {
      var self = this;
      return this.session().then(function(resp){
        var userDb = self.db(resp.info.authentication_db);
        return userDb;
      });
    },

    signup: function(user_doc, password, options) {      
      options = options || {};
      // prepare user doc based on name and password
      user_doc = this.prepareUserDoc(user_doc, password);
      return  this.userDb()
                .then(
                    function(userDb) {
                      return userDb.saveDoc(user_doc, options);
                    });
    },

    prepareUserDoc: function(user_doc, new_password) {
      if (typeof hex_sha1 == "undefined") {
        alert("creating a user doc requires sha1.js to be loaded in the page");
        return;
      }
      var user_prefix = "org.couchdb.user:";
      user_doc._id = user_doc._id || user_prefix + user_doc.name;
      if (new_password) {
        // handle the password crypto
        user_doc.salt = this.newUUID();//$.couch.newUUID();
        user_doc.password_sha = hex_sha1(new_password + user_doc.salt);
      }
      user_doc.type = "user";
      if (!user_doc.roles) {
        user_doc.roles = [];
      }
      return user_doc;
    },

    login: function(options) {
      options = options || {};

      return dojo.xhr("POST",{url:this.urlPrefix + "/_session"
        , handleAs : "json"
        , content : {name: options.name, password: options.password}
        , load : function(resp,ioargs){
            resp = resp || {};
            ioargs = ioargs || {};
            var respStatus = ioargs.xhr.status;
            if (respStatus == 200) {
              if (options.success) {
                options.success(resp,ioargs);
                console.error("success called ln 181");
              }
            } else {
              alert("An error occurred logging in: " + resp.reason);
            }
            return resp;
          }
        ,  error : function (resp, ioargs){
            console.log("Ajax error logging in. Response ==> ", resp, ", IOArgs ==> ", ioargs);
            if (options.error) options.error(resp,ioargs);
            return resp || {};
          } 
      });
    },

    logout: function(options) {
      options = options || {};
      return dojo.xhr("DELETE",{url:this.urlPrefix + "/_session"
        , handleAs : "json"
        , content : {username : "_", password : "_"}
        , load : function(resp,ioargs){
            var respStatus = ioargs.xhr.status;
            if (respStatus == 200) {
              if (options.success) {
                options.success(resp,ioargs);
                console.error("success called ln 206");
              }
            } else {
              console.log("An error occurred logging out: " + resp.reason);
              options.error && options.error(resp,ioargs);
            }
            return resp;
          }
        ,  error : function (response, ioargs){
            alert("Ajax error logging out. Response ==> ", response, ", IOArgs ==> ", ioargs);
            options.error && options.error(response,ioargs);
            return response;
          } 
      });
    },

    db: function(name, db_opts) {
      db_opts = db_opts || {};
      var rawDocs = {};
      function maybeApplyVersion(doc) {
        if (doc._id && doc._rev && rawDocs[doc._id] && rawDocs[doc._id].rev == doc._rev) {
          // todo: can we use commonjs require here?
          if (typeof Base64 == "undefined") {
            alert("please include /_utils/script/base64.js in the page for base64 support");
            return false;
          } else {
            doc._attachments = doc._attachments || {};
            doc._attachments["rev-"+doc._rev.split("-")[0]] = {
              content_type :"application/json",
              data : Base64.encode(rawDocs[doc._id].raw)
            };
            return true;
          }
        }
      };
      return {
        name: name,
        uri: this.urlPrefix + "/" + encodeURIComponent(name) + "/",

        compact: function(options) {
          dojo.mixin(options, {successStatus: 202});
          return dojocouch.util.Couch.ajax({
              type: "POST", url: this.uri + "_compact",
              data: "", processData: false
            },
            options,
            "The database could not be compacted"
          );
        },
        viewCleanup: function(options) {
          dojo.mixin(options, {successStatus: 202});
          return dojocouch.util.Couch.ajax({
              type: "POST", url: this.uri + "_view_cleanup",
              data: "", processData: false
            },
            options,
            "The views could not be cleaned up"
          );
        },
        compactView: function(groupname, options) {
          dojo.mixin(options, {successStatus: 202});
          return dojocouch.util.Couch.ajax({
              type: "POST", url: this.uri + "_compact/" + groupname,
              data: "", processData: false
            },
            options,
            "The view could not be compacted"
          );
        },
        create: function(options) {
          options = options || {};
          dojo.mixin(options,{successStatus: 201});
          return dojocouch.util.Couch.ajax({
              type: "PUT", url: this.uri, contentType: "application/json",
              data: "", processData: false
            },
            options,
            "The database could not be created"
          );
        },
        drop: function(options) {
          return dojocouch.util.Couch.ajax(
            {type: "DELETE", url: this.uri},
            options,
            "The database could not be deleted"
          );
        },
        info: function(options) {
          return dojocouch.util.Couch.ajax(
            {url: this.uri},
            options,
            "Database information could not be retrieved"
          );
        },
        changes: function(since, options) {
          options = options || {};
          // set up the promise object within a closure for this handler
          var timeout = 100, db = this, active = true,
            listeners = [],
            promise = {
            onChange : function(fun) {
              listeners.push(fun);
            },
            stop : function() {
              active = false;
            }
          };
          // call each listener when there is a change
          function triggerListeners(resp) {
            for (var idx in Listeners){
              listeners[idx](resp);
            }
          };
          // when there is a change, call any listeners, then check for another change
          options.success = function(resp) {
            timeout = 100;
            if (active) {
              since = resp.last_seq;
              triggerListeners(resp);
              getChangesSince();
            };
          };
          options.error = function() {
            if (active) {
              setTimeout(getChangesSince, timeout);
              timeout = timeout * 2;
            }
          };
          // actually make the changes request
          function getChangesSince() {
            var opts = dojo.mixin({heartbeat : 10 * 1000}, options, {
              feed : "longpoll",
              since : since
            });
            dojocouch.util.Couch.ajax(
              {url: db.uri + "_changes"+dojocouch.util.Couch.encodeOptions(opts)},
              options,
              "Error connecting to "+db.uri+"/_changes."
            );
          }
          // start the first request
          if (since) {
            getChangesSince();
          } else {
            db.info({
              success : function(info) {
                since = info.update_seq;
                getChangesSince();
              }
            });
          }
          return promise;
        },
        allDocs: function(options) {
          options = options || {};
          var type = "GET";
          var data;
          if (options["keys"]) {
            type = "POST";
            var keys = options["keys"];
            delete options["keys"];
            data = dojocouch.util.Couch.toJSON({ "keys": keys });
          }
          
          return dojocouch.util.Couch.ajax({
              type: type,
              data: data,
              url: this.uri + "_all_docs" + dojocouch.util.Couch.encodeOptions(options),
              postData : data  // be sure that having undefined here doesn't mess up the xhr
            },
            options,
            "An error occurred retrieving a list of all documents"
          );
        },
        allDesignDocs: function(options) {
          return this.allDocs(dojo.mixin({startkey:"_design", endkey:"_design0"}, options));
        },
        allApps: function(options) {
          options = options || {};
          var self = this;
          var df = new dojo.Deferred();
          if (options.eachApp) {
            this.allDesignDocs().then(
              function(resp) {
                var dl = []; // list to hold deferreds for following calls.
                dojo.forEach(resp.rows, function(entry) {
                  dl.push(
                    self.openDoc(entry.id).then(
                      function(ddoc) {
                        var index, appPath, appName = ddoc._id.split('/');
                        appName.shift();
                        appName = appName.join('/');
                        index = ddoc.couchapp && ddoc.couchapp.index;
                        if (index) {
                          appPath = ['', name, ddoc._id, index].join('/');
                        } else if (ddoc._attachments && ddoc._attachments["index.html"]) {
                          appPath = ['', name, ddoc._id, "index.html"].join('/');
                        }
                        if (appPath) options.eachApp(appName, appPath, ddoc);
                      }
                  ));
                });
                var dfl = new dojo.DeferredList(dl);
                dfl.addCallback(function(res){
                  df.callback(res); // res is an array of the individual callback results.
                });
              },
              function(resp){
                df.errback(resp);
              }
            );
            return df;
          } else {
            alert("Please provide an eachApp function for allApps()");
          }
        },
        openDoc: function(docId, options, ajaxOptions) {
          options = options || {};
 
          return dojocouch.util.Couch.ajax({url: this.uri + dojocouch.util.Couch.encodeDocId(docId) 
                                                + dojocouch.util.Couch.encodeOptions(options)},
            options,
            "The document could not be retrieved",
            ajaxOptions
          ).then(function(resp){
            if (db_opts.attachPrevRev || options.attachPrevRev) {
              rawDocs[resp._id] = {
                  rev : resp._rev,
                  raw : resp.responseText
                };
            }
            return resp;
          });
        },
        saveDoc: function(doc, options) {
          options = options || {};
          var db = this;
          //var beforeSend = dojocouch.util.Couch.fullCommit(options);
          if (doc._id === undefined) {
            var method = "POST";
            var uri = this.uri;
          } else {
            var method = "PUT";
            var uri = this.uri + dojocouch.util.Couch.encodeDocId(doc._id);
          }
          var versioned = maybeApplyVersion(doc);

          dojocouch.util.Couch.fullCommit(options); // modifies headers in options.

          var headers = options.headers || {};
          headers["content-type"] = "application/json";

          doc = dojocouch.util.Couch.toJSON(doc);

          var df = new dojo.Deferred();


          dojo.xhr(method,{url:uri + dojocouch.util.Couch.encodeOptions(options)
            , handleAs : "json"
            , headers  : headers
            , postData : doc
            , load : function(resp,ioargs){
                var respStatus = ioargs.xhr.status;

                if (respStatus == 200 || respStatus == 201 || respStatus == 202) {
                  doc._id = resp.id;
                  doc._rev = resp.rev;
                  if (versioned) {
                    db.openDoc(doc._id, {
                      attachPrevRev : true
                    }).then(
                      function(d) {
                        doc._attachments = d._attachments;
                        df.callback(resp);
                      },
                      function(d,ioargs){
                        df.callback(resp);
                      }
                    );
                  } else {
                    df.callback(resp);
                  } 
                } else {
                  alert("The document could not be saved: " + resp.reason);
                  df.errback(resp);
                }
               
              }
            ,  error : function (response, ioargs){
                alert("Ajax error saving document. Response ==> " + response.message
                      + ",\n Server Says ==> " + ioargs.xhr.responseText);
                df.errback(response);
              } 
          });

          return df;
        },
        
        bulkSave: function(docs, options) {
          dojocouch.util.Couch.fullCommit(options);
          docs = dojocouch.util.Couch.toJSON({docs:docs});
          var uri = this.uri + "_bulk_docs" + dojocouch.util.Couch.encodeOptions(options); 
          dojo.mixin(options, {successStatus: 201});
          return dojocouch.util.Couch.ajax({
              type: "POST",
              url: uri,
              contentType: "application/json", 
              postData: docs
            },
            options,
            "The documents could not be saved"
          );
        },
        removeDoc: function(doc, options) {
          return dojocouch.util.Couch.ajax({
              type: "DELETE",
              url: this.uri +
                   dojocouch.util.Couch.encodeDocId(doc._id) +
                   dojocouch.util.Couch.encodeOptions({rev: doc._rev})
            },
            options,
            "The document could not be deleted"
          );
        },
        bulkRemove: function(docs, options){
          dojo.forEach(docs.docs,function(doc){
            doc._deleted = true;
          });
          docs = dojocouch.util.Couch.toJSON(docs);
          var uri = this.uri + "_bulk_docs" + dojocouch.util.Couch.encodeOptions(options);
          dojo.mixin(options, {successStatus: 201});
          return dojocouch.util.Couch.ajax({
              type: "POST",
              url: uri,
              postData : docs
            },
            options,
            "The documents could not be deleted"
          );
        },
        copyDoc: function(docId, options, ajaxOptions) {
          ajaxOptions = dojo.mixin(ajaxOptions, {
            complete: function(req) {
              var resp = httpData(req, "json");
              if (req.status == 201) {
                if (options.success) {
                          options.success(resp);
                          console.error("success called ln 494");
                        }
              } else if (options.error) {
                options.error(req.status, resp.error, resp.reason);
              } else {
                alert("The document could not be copied: " + resp.reason);
              }
            }
          });
          return dojocouch.util.Couch.ajax({
              type: "COPY",
              url: this.uri + dojocouch.util.Couch.encodeDocId(docId)
            },
            options,
            "The document could not be copied",
            ajaxOptions
          );
        },
        query: function(mapFun, reduceFun, language, options) {
          language = language || "javascript";
          if (typeof(mapFun) !== "string") {
            mapFun = mapFun.toSource ? mapFun.toSource() : "(" + mapFun.toString() + ")";
          }
          var body = {language: language, map: mapFun};
          if (reduceFun != null) {
            if (typeof(reduceFun) !== "string")
              reduceFun = reduceFun.toSource ? reduceFun.toSource() : "(" + reduceFun.toString() + ")";
            body.reduce = reduceFun;
          }
          return dojocouch.util.Couch.ajax({
              type: "POST",
              url: this.uri + "_temp_view" + dojocouch.util.Couch.encodeOptions(options),
              contentType: "application/json",
              handleAs: 'json', 
              postData: dojocouch.util.Couch.toJSON(body)
            },
            options,
            "An error occurred querying the database"
          );
        },
        list: function(list, view, options) {
          var list = list.split('/');
          var options = options || {};
          var type = 'GET';
          var data = null;
          if (options['keys']) {
            type = 'POST';
            var keys = options['keys'];
            delete options['keys'];
            data = {'keys': keys };
          }
          return dojocouch.util.Couch.ajax({
              type: type,
              data: data,
              url: this.uri + '_design/' + list[0] +
                   '/_list/' + list[1] + '/' + view + dojocouch.util.Couch.encodeOptions(options)
              },
              options, 'An error occured accessing the list'
          );
        },
        view: function(name, options) {
          var name = name.split('/');
          var options = options || {};
          var type = "GET";
          var data= null;
          if (options["keys"]) {
            type = "POST";
            var keys = options["keys"];
            delete options["keys"];
            data = dojocouch.util.Couch.toJSON({ "keys": keys});
          }

          var ajaxOptions = {preventCache : true}; // noCache true by default.
          options.noCache && (ajaxOptions.preventCache = options.noCache); // allow to be overriden
          delete options.noCache;

          return dojocouch.util.Couch.ajax({
              type: type,
              data: data,
              url: this.uri + "_design/" + name[0] +
                   "/_view/" + name[1] + dojocouch.util.Couch.encodeOptions(options)
            },
            options, "An error occurred accessing the view",
            ajaxOptions
          );
        },
        getDbProperty: function(propName, options, ajaxOptions) {
          return dojocouch.util.Couch.ajax({url: this.uri + propName + dojocouch.util.Couch.encodeOptions(options)},
            options,
            "The property could not be retrieved",
            ajaxOptions
          );
        },

        setDbProperty: function(propName, propValue, options, ajaxOptions) {
          return dojocouch.util.Couch.ajax({
            type: "PUT", 
            url: this.uri + propName + dojocouch.util.Couch.encodeOptions(options),
            data : dojocouch.util.Couch.toJSON(propValue)
          },
            options,
            "The property could not be updated",
            ajaxOptions
          );
        }
      };
    },

    info: function(options) {
      return dojocouch.util.Couch.ajax(
        {url: this.urlPrefix + "/"},
        options,
        "Server information could not be retrieved"
      );
    },

    replicate: function(source, target, ajaxOptions, repOpts) {
      repOpts = dojo.mixin({source: source, target: target}, repOpts);
      if (repOpts.continuous && !repOpts.cancel) {
        ajaxOptions.successStatus = 202;
      }
      return dojocouch.util.Couch.ajax({
          type: "POST", url: this.urlPrefix + "/_replicate",
          data: dojocouch.util.Couch.toJSON(repOpts),
          contentType: "application/json"
        },
        ajaxOptions,
        "Replication failed"
      );
    },

    newUUID: function(cacheNum) {
      var self =  this;
      if (cacheNum === undefined) {
        cacheNum = 10;
      }
      if (self.uuidCache.length < 5) {
        dojocouch.util.Couch.ajax({url: this.urlPrefix + "/_uuids", 
                          content: {count: cacheNum}, 
                          sync: self.uuidCache.length < 1
                        }, {
                        success: function(resp) {
                          self.uuidCache = self.uuidCache.concat(resp.uuids);
                        }
          },
          "Failed to retrieve UUID batch."
        );
      }
      return self.uuidCache.shift();
    }
});




//=====================================================================================================
// ================= End dojo.extend($.couch ...) =====================================================
//=====================================================================================================



  dojocouch.util.Couch.encodeDocId = function(docID) {
    var parts = docID.split("/");
    if (parts[0] == "_design") {
      parts.shift();
      return "_design/" + encodeURIComponent(parts.join('/'));
    }
    return encodeURIComponent(docID);
  };

  dojocouch.util.Couch.ajax = function(obj, options, errorMessage, ajaxOptions) {

    var defaultAjaxOpts = {
      contentType: "application/json",
      headers:{"Accept": "application/json"}
    };

    options = dojo.mixin({successStatus: 200}, options);
    ajaxOptions = dojo.mixin(defaultAjaxOpts, ajaxOptions);

    var headers = {};
    if(ajaxOptions && ajaxOptions.headers){
      for (var header in ajaxOptions.headers){
        headers[header] = ajaxOptions.headers[header];
      }
    }

    errorMessage = errorMessage || "Unknown error";

    var ajopt = {handleAs : "json"
      , headers : headers
      , contentType : ajaxOptions.contentType
      , load: function(resp,ioargs) {
          ioargs = ioargs || {};
          resp = resp || {};
          var respStatus = ioargs.xhr && ioargs.xhr.status;
          if (options.ajaxStart) {
            options.ajaxStart(resp);
          }
          if (respStatus == options.successStatus) {
            if (options.beforeSuccess) {
              options.beforeSuccess(resp,ioargs);
              console.error("before success called ln 841");
              console.trace();
            }
            if (options.success) {
              options.success(resp,ioargs);
              console.error("success called ln 845");
            }
          } else {
            alert(errorMessage + ": " + resp.toString());
            options.error && options.error(resp || errorMessage,ioargs);
          }
          return resp;
        }
      , error : function(resp,ioargs){
            resp = resp || errorMessage;
            options.error && options.error(resp || errorMessage, ioargs || {});
            return resp;
        }
    }

    dojo.mixin(ajopt,obj,ajaxOptions);
    var method = ajopt.type || "GET";
    delete ajopt.method;

      // fixup data field, if any. 
      // The data field is used for POST or PUT data content. The field name 
      // needs to be changed to postData or putData respectively if present.
    if ((ajopt.type == "POST" || ajopt.type == "PUT") && ajopt.data){
      if (ajopt.type == "POST"){
        ajopt.postData = ajopt.data;
      } else if (ajopt.type == "PUT"){
        ajopt.putData = ajopt.data;
      }
      delete ajopt.data;
    }

    return dojo.xhr(method,ajopt);
  }

  dojocouch.util.Couch.fullCommit = function(options) {
    var options = options || {};
    if (typeof options.ensure_full_commit !== "undefined") {
      var commit = options.ensure_full_commit;
      delete options.ensure_full_commit;
      var headers = options.headers = options.headers || {};
      headers["X-Couch-Full-Commit"] = commit.toString();
    }
  };

  // Convert a options object to an url query string.
  // ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
  dojocouch.util.Couch.encodeOptions = function(options) {
    var buf = [];
    if (typeof(options) === "object" && options !== null) {
      for (var name in options) {
          // load & handle added for dojo. success, beforeSuccess can likely be removed. ajaxStart?
        //if ($.inArray(name, ["error", "success", "beforeSuccess", "ajaxStart","load","handle"]) >= 0)
        if (dojo.indexOf(["error", "success", "beforeSuccess", "ajaxStart","load","handle"],name) > -1)
          continue;
        var value = options[name];
        if (dojo.indexOf(["key", "startkey", "endkey"],name) >= 0) {
          value = dojocouch.util.Couch.toJSON(value);
        }
        buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
      }
    }
    return buf.length ? "?" + buf.join("&") : "";
  }

  dojocouch.util.Couch.toJSON = function(obj) {
    return obj !== null ? JSON.stringify(obj,function(key,val){
        // handle case where value is a function.
      if (typeof val == 'function'){
        return val.toString();
      }
      return val;
    }) : null;
  }
