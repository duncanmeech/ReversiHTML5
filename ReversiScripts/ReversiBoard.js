//
// a canvas based board for the game. Create with the canvas object
//
function ReversiBoard(c) {

    // save the canvas and start loading the board image

    this.Canvas = c;

    this.Context = this.Canvas.getContext("2d");

    // create empty stones array

    this.Stones = new Array(this.Rows * this.Cols);

    var i;

    for (i = 0 ; i < this.Stones.length ; i++)
        this.Stones[i] = EMPTY;

    // calculate square size

    var md = Math.min(this.Canvas.width, this.Canvas.height);

    this.SqSize = Math.round(md / this.Rows);

    // draw initial board

    this.RedrawBoard();

    // make this available as self for anon functions

    var self = this;

    // sink mouse move on canvas

    this.Canvas.addEventListener('mousemove',

    function (evt) {

        // only if enabled

        if ( self.enabled == true ) {

            self.InputMove( evt.pageX, evt.pageY );
        }
    },

    false);



    // hide cursor on mouse leave

    this.Canvas.addEventListener('mouseleave',

    function () {

        if (self.enabled == true && self.cursorRow >= 0 && self.cursorCol >= 0) {

            self.InputEnd();

        }
    }

    , false);

    // fire square click event on mouse down if square is empty

    this.Canvas.addEventListener('click',

    function (evt) {

        if ( self.enabled == true ) {

            self.InputClick( evt.pageX, evt.pageY );
        }
    }

    , false);

    // handle gesture inputs on iOS, calling preventDefault stop these events propogating as regular mouse events
    // and also disables the panning that occurs by defaults on elements in the iOS browser.

    var touchX,touchY;

    this.Canvas.addEventListener('touchstart',

        function (evt) {

            if ( self.enabled == true ) {

                evt.preventDefault();

                touchX = evt.targetTouches[0].pageX;

                touchY = evt.targetTouches[0].pageY;

                self.InputMove( touchX, touchY );

            }
        }

        , false);

    this.Canvas.addEventListener('touchmove',

        function (evt) {

            if ( self.enabled == true ) {

                evt.preventDefault();

                touchX = evt.targetTouches[0].pageX;

                touchY = evt.targetTouches[0].pageY;

                self.InputMove( touchX, touchY );
            }
        }

        , false);

    this.Canvas.addEventListener('touchend',

        function (evt) {

            if ( self.enabled == true ) {

                evt.preventDefault();

                self.InputClick( touchX, touchY);

                self.InputEnd();
            }
        }

        , false);

    this.Canvas.addEventListener('touchcancel',

        function (evt) {

            if ( self.enabled == true ) {

                evt.preventDefault();

                self.InputEnd();
            }
        }

        , false);
}

//
// input at the given pageX,pageY
//
ReversiBoard.prototype.InputMove = function(x,y) {

    // get row / column of mouse

    var coords = this.LocalCoordinates(x,y);

    r = Math.max(0, Math.min(parseInt(coords.y / this.SqSize), this.Rows - 1));

    c = Math.max(0, Math.min(parseInt(coords.x / this.SqSize), this.Cols - 1));

    // if different than the currently highlighted square

    if ( r != this.cursorRow || c != this.cursorCol ) {

        // un-highlight the current square

        if (this.cursorRow >= 0 && this.cursorCol >= 0) {

            var tempr = this.cursorRow;

            var tempc = this.cursorCol;

            this.cursorRow = this.cursorCol = -1;

            this.PaintSquare(tempr, tempc);
        }

        // highlight new square

        this.cursorRow = r;

        this.cursorCol = c;

        this.PaintSquare(r, c);

    }

}

//
// handle a click at the given location
//
ReversiBoard.prototype.InputClick = function(x,y){

    var coords = this.LocalCoordinates(x,y);

    var r = Math.max(0, Math.min(parseInt(coords.y / this.SqSize), this.Rows - 1));

    var c = Math.max(0, Math.min(parseInt(coords.x / this.SqSize), this.Cols - 1));

    if ( this.Stones[r * this.Cols + c] == EMPTY ) {
        this.SquareClicked.Invoke(r, c);
    }
}

//
// when the mouse leaves ( or the screen is released on a gesture device )
//
ReversiBoard.prototype.InputEnd = function() {
    
    var tempr = this.cursorRow;
    
    var tempc = this.cursorCol;
    
    this.cursorRow = this.cursorCol = -1;
    
    this.PaintSquare(tempr, tempc);
}

//
// click handler
//
ReversiBoard.prototype.SquareClicked = new Eventist();


//
// update the board with an array directly from the engine.
//
ReversiBoard.prototype.UpdateBoard = function (board,lastmove,legalmoves) {

    // copy and redraw

    var i;

    for (i = 0 ; i < this.Stones.length ; i++)
        this.Stones[i] = board[i];

    this.lastMove = lastmove;

    this.legalMoves = legalmoves;

    this.RedrawBoard();

}

// list of legal moves for the current position

ReversiBoard.prototype.legalMoves;

// the last move played

ReversiBoard.prototype.lastMove;


//
// metrics used to paint the board
//
ReversiBoard.prototype.Rows = 8;

ReversiBoard.prototype.Cols = 8;

//
// an array of [ EMPTY,WHITE,BLACK ] indicating stone located on each square
//
ReversiBoard.prototype.Stones = null;

//
// array of currently display stones 
//
var WHITE = 0;

var BLACK = 1;

var EMPTY = 2;



// current square of cursor highlight or -1

ReversiBoard.prototype.cursorCol = -1;

ReversiBoard.prototype.cursorRow = -1;

// calculate to the size of each square

ReversiBoard.prototype.SqSize;

//
// call to enable or disable the input cursor
//
ReversiBoard.prototype.EnableCursor = function( b ) {

    if ( b != this.enabled ) {

        this.enabled=b;

        // redraw current highlight square if there is one

        if (this.cursorRow >= 0 && this.cursorCol >= 0) {

            this.PaintSquare(this.cursorRow,this.cursorCol);
        }
    }
}

// disabled by default

ReversiBoard.prototype.enabled = false;

//
// repaint an individual square
//
ReversiBoard.prototype.PaintSquare = function (r, c) {


    // for easier reading...

    var s = this.SqSize;

    // get square bounds and center

    var left = c * s;

    var right = c * s + s - 1;

    var top = r * s;

    var bottom = r * s + s - 1;

    var xc = c * s + s / 2;

    var yc = r * s + s / 2;


    // paint the square and a light edge

    this.Context.fillStyle = '#009E0B';

    this.Context.beginPath();

    this.Context.rect(left,top,s,s);

    this.Context.fill();

    this.Context.lineWidth = 1;

    this.Context.strokeStyle = 'rgba(0,0,0,0.25)';

    this.Context.stroke();


    // paint the stone in this location

    if (this.Stones[r * this.Cols + c] != EMPTY ) {

        var grd = this.Context.createRadialGradient(left + this.SqSize/3,top + this.SqSize/3,0,xc,yc, this.SqSize/2 - 3);

        if (this.Stones[r * this.Cols + c] == WHITE) {
 
            grd.addColorStop(0, '#FFFFFF');

            grd.addColorStop(1, '#808080');
        }
        else {

            grd.addColorStop(0, '#707070');

            grd.addColorStop(1, '#000000');
        }

        this.Context.fillStyle = grd;
    
        this.Context.beginPath();

        this.Context.arc(xc, yc, this.SqSize / 2 - 3, 0, Math.PI * 2, true);

        this.Context.closePath();

        this.Context.fill();

    }


    // paint highlight if present and we are enabled for input and square is empty

    if ( this.enabled == true && this.cursorCol == c && this.cursorRow == r && this.Stones[r * this.Cols + c] == EMPTY) {

        this.Context.fillStyle = 'rgba( 255,255,255,0.25 )';

        this.Context.beginPath();

        this.Context.arc(xc, yc, this.SqSize / 8 , 0, Math.PI * 2, true);

        this.Context.closePath();

        this.Context.fill();

    }

    // if square is the last move played, highlight we red dot


    if ( this.lastMove != null && this.lastMove.Row == r && this.lastMove.Column == c ) {

        this.Context.fillStyle = 'rgb( 255,0,0 )';

        this.Context.beginPath();

        this.Context.arc(xc, yc, this.SqSize / 16 , 0, Math.PI * 2, true);

        this.Context.closePath();

        this.Context.fill();

    }

    // highlight square if its in the legal move list

    if ( this.legalMoves != null ) {
        for( var i = 0 ; i < this.legalMoves.length ; i++ ) {
            if ( this.legalMoves[i].Row == r && this.legalMoves[i].Column == c ) {

                this.Context.fillStyle = 'rgba( 0,0,0,0.15 )';

                this.Context.beginPath();

                this.Context.arc(xc, yc, this.SqSize / 4 , 0, Math.PI * 2, true);

                this.Context.closePath();

                this.Context.fill();

                break;
            }
        }
    }

    // draw row/col index

    //this.Context.font = "10pt Arial";

    //this.Context.textAlign = "left";

    //this.Context.fillStyle = "black";

    //this.Context.fillText(r.toString() + c.toString(), left+2, top + 15);
}

//
// redraw entire board
//
ReversiBoard.prototype.RedrawBoard = function () {

    // clear canvas

    //this.Context.clearRect(0,0,this.Canvas.width,this.Canvas.height);

    // paint all squares

    var i, j;

    for (i = 0 ; i < this.Rows ; i++)
        for (j = 0 ; j < this.Cols ; j++) {
            this.PaintSquare(i, j);
        }
}


//
// get mouse coordinates from an event object in local coordinate space
//
ReversiBoard.prototype.LocalCoordinates = function (x,y) {

    // traverse our parent chain accumulating the offsets of each, then we can apply that to the page mouse coordinates

    var totalOffsetX = 0;

    var totalOffsetY = 0;

    var canvasX = 0;

    var canvasY = 0;

    var currentElement = this.Canvas;

    do {
        totalOffsetX += currentElement.offsetLeft;

        totalOffsetY += currentElement.offsetTop;
    }
    while (currentElement = currentElement.offsetParent)

    canvasX = x - totalOffsetX;

    canvasY = y - totalOffsetY;

    return { x: canvasX, y: canvasY }
}


// canvas object we render into

ReversiBoard.prototype.Canvas;

// drawing context for canvas

ReversiBoard.prototype.Context;





