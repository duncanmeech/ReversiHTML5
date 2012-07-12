//
// Simple wrapper around a collection of functions
//
function Eventist() {
}

Eventist.prototype.callbacks = [];

//
// add a function to the callback collection
//
Eventist.prototype.Add = function (f) {

    this.callbacks.push(f);
}

//
// remove any exact references to f
//
Eventist.prototype.Remove = function (f) {

    var i = 0;

    while ( i < this.callbacks.length )
     {
         if (this.callbacks[i] === f)
             this.callbacks.splice(i, 1);
         else
             i++;
    }

}

//
// invoke all the callbacks with the given parameters
//
Eventist.prototype.Invoke = function () {

    var i = 0;

    while ( i < this.callbacks.length ) {

        this.callbacks[i++](arguments);

    }
}


