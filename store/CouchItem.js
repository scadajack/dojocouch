dojo.provide("dojocouch.store.CouchItem");


// This class will provide a wrapper for items retrieved from an external store.
// It has methods that dojo.data.ObjectStore expects for an item to make an 
// ObjectStore look like a DataStore.

// Any methods that are not useful for the Object Store implementation are 
// prefixed with _ to help differentiate them from actual item names. So the 
// only properties that the wrapper adds with non-underscore names are 
// isItem and load. 'load' is added only to the property (not the prototype) 
// and it is typically cleared after the item is loaded.



dojocouch.store.CouchItem.wrapper = function(store){
	return new CouchItemDelWrapper(store);
}

function CouchItemDelWrapper(store){
	this.store = store;
}

CouchItemDelWrapper.prototype.get = function(attr){
	var at = attr;
	if (at in this){
		return this[at];
	} else if (typeof this.load === "function"){ // check if not loaded
		return dojo.when(this._load(),
			function(result){
				return result[at];
			}
		);
	}
}

CouchItemDelWrapper.prototype._load = function(){
	// load item and then delete the load function from item so 
	// we know its been loaded.
	var df = new dojo.Deferred();
	dojo.when(store.get(this[store.idProperty]),
		function(result){
			delete this.load;
			df.callback(result);
		},
		function(result){
			console.log("CouchItemDelWrapper error on loading item -->",this);
		}
	);
	return df;
}

// A way to detect that this is a wrapped item.
// Object 
CouchItemDelWrapper.prototype.isItem = function(){
	return true;
}

CouchItemDelWrapper.prototype._wrap = function(item,stub){
	if (stub){
		item.load = this._load();
	}

	return dojo.delegate(this,item);
}