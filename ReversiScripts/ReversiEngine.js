//-----------------------------------------------------------------------------------------------------
// this section is the event handler for the web worker.
// we initialized we create and initialize an actual engine object and save it for later
//-----------------------------------------------------------------------------------------------------


self.onmessage = function ( event ) {

    switch (event.data.name) {

        // the first message, create the engine and initialize

        case "M_Initialize": {

            theEngine = new ReversiEngine(this);

            this.postMessage({  name: "M_Initialize_ACK",
                                state:theEngine.EngineState(),
                                board:theEngine.FlatBoard(),
                                moves:theEngine.GetLegalMoveLocations(theEngine.side,theEngine.otherSide),
                                totals:{White:theEngine.whiteTotal,Black:theEngine.blackTotal} } );

        } break;

        // start a new game

        case "M_NewGame":{

            theEngine.NewGame();

            this.postMessage({  name: "M_NewGame_ACK",
                                state:theEngine.EngineState(),
                                board:theEngine.FlatBoard(),
                                moves:theEngine.GetLegalMoveLocations(theEngine.side,theEngine.otherSide),
                                totals:{White:theEngine.whiteTotal,Black:theEngine.blackTotal}});

        } break;

        // make a move for the current side to move

        case "M_MakeMove": {

            // set thinking time as passed to us

            theEngine.thinkingTime = event.data.thinkingTime;

            // make the move and post back the PV and the new state of the game

            var pvs = theEngine.MakeMove();

            this.postMessage({  name: "M_MakeMove_ACK",
                                pvs:pvs,
                                state:theEngine.EngineState(),
                                board:theEngine.FlatBoard(),
                                lastmove:theEngine.LastMove(),
                                moves:theEngine.GetLegalMoveLocations(theEngine.side,theEngine.otherSide),
                                knodes:theEngine.knodes,
                                totals:{White:theEngine.whiteTotal,Black:theEngine.blackTotal}});

        } break;

        // play move and return the new state of the board and game

        case "M_PlayMove": {

            // make the move and post back the PV and the new state of the game

            var row = event.data.row;

            var column = event.data.column;

            var legal = theEngine.PlayUserMove(row,column);

            if ( legal == true )
                this.postMessage({  name: "M_PlayMove_ACK",
                                    legal:true,
                                    state:theEngine.EngineState(),
                                    lastmove:theEngine.LastMove(),
                                    board:theEngine.FlatBoard(),
                                    totals:{White:theEngine.whiteTotal,Black:theEngine.blackTotal}});
            else
                this.postMessage({  name: "M_PlayMove_ACK",
                                    legal:false,
                                    state:theEngine.EngineState(),
                                    totals:{White:theEngine.whiteTotal,Black:theEngine.blackTotal} });

        } break;


        // remove last move from move history and return new state of the game

        case "M_TakeBack" : {

            theEngine.TakeBack();

            this.postMessage({  name: "M_TakeBack_ACK",
                                state:theEngine.EngineState(),
                                board:theEngine.FlatBoard(),
                                lastmove:theEngine.LastMove(),
                                moves:theEngine.GetLegalMoveLocations(theEngine.side,theEngine.otherSide),
                                totals:{White:theEngine.whiteTotal,Black:theEngine.blackTotal}});

        } break;
    }
}

// the instance of Engine class

var theEngine;

// rows and columns in board

var ROWS = 8;

var COLS = 8;

// possible values for any square

var WHITE = 0x00;

var BLACK = 0x01;

var EMPTY = 0x02;

var INVALID = 0x03;


// A bit packed move can represent a null move using this value which can't ordinarily appear

var NULL_MOVE = -1;

// Do NOT confuse this with NULL_MOVE. NULL_MOVE indicates a pass and is a playable move in certain circumstances i.e when a player must PASS
// This is simply a move that cannot exist or be played and is used in situations where we want a nullable value type ( since those aren't available
// in other languages )

var NO_MOVE = -2;

// max depth of search

var MAX_DEPTH = 60;

// max number of legal moves ( although in practise it will never be 64 this is clearly the upper limit )

var MAX_MOVES = 64;


// Indexes of corners and adjacent squares

var NW_CORNER = 0x00;

var NW_C1 = 0x01;

var NW_C2 = 0x10;

var NW_X = 0x11;


var NE_CORNER = 0x07;

var NE_C1 = 0x06;

var NE_C2 = 0x17;

var NE_X = 0x16;


var SW_CORNER = 0x70;

var SW_C1 = 0x60;

var SW_C2 = 0x71;

var SW_X = 0x61;


var SE_CORNER = 0x77;

var SE_C1 = 0x67;

var SE_C2 = 0x76;

var SE_X = 0x66;


// TT table constants

// size of hash tables

var TT_SIZE = 10000;

// Indicates no hit in TT

var TT_FAIL = Number.MAX_VALUE;

// Types of scores in TT

var TT_EXACT = 0;

var TT_UPPER = 1;

var TT_LOWER = 2;

// To isolate the index of the move use this mask. NOTE, you cannot use this mask directly on the board, this mask just
// isolates the bits in the move that represent the location and is used to make history take access faster

var INDEX_MASK = 0x7E;

// engine state constants

var WHITE_WIN = 0;

var BLACK_WIN = 1;

var WHITE_MOVE = 2;

var BLACK_MOVE = 3;

var DRAW = 4;

var WHITE_PASS = 5;

var BLACK_PASS = 6;


// search result for a WIN

var WIN = 100000;


//  The search algorithm return WIN + ply when a terminal position is reached. Adding ply is necessary otherwise the
// score of the branch will never exceed the initial window width ( -WIN, +WIN ) and the search will not find a move

var WIN_APPROXIMATION = WIN - 1000;

//--------------------------------------------------------------------
// HashEntry class for TT 
//--------------------------------------------------------------------
function HashEntry() {

    this.height = -1;
}

// hash key ... unsigned 31 bit integer

HashEntry.prototype.key;

// depth of search resulting in hash entry

HashEntry.prototype.height;

// type of hash entry

HashEntry.prototype.flags;

// score for this position

HashEntry.prototype.score;

// best move in this position

HashEntry.prototype.bestMove;

//----------------------------------------------------------------------
// hash entry for leaf nodes
//----------------------------------------------------------------------

function LeafHashEntry() {

}

LeafHashEntry.prototype.key;

LeafHashEntry.prototype.score;


//----------------------------------------------------------------------
// Reversi engine
//----------------------------------------------------------------------


//
// ctor
//
function ReversiEngine() {

    this.NewGame();
}


// side the move and the side not to move

ReversiEngine.prototype.side;

ReversiEngine.prototype.otherSide;

// array of point values for each square on the board. Certains squares change their
// valuation as the game proceeds so this is reset at the start of the game and updated
// as pieces are played.

//
// new game initializer
//
ReversiEngine.prototype.NewGame = function() {

    // set sides

    this.side = BLACK;

    this.otherSide = WHITE;

    // copy square values AND build a list of squares that have positional value. This is used
    // to speed up the score function

    this.squareValues = new Array(this.initialSquareValues.length);

    this.valuableSquaresIndex = [];

    var i;

    for (i = 0; i < this.initialSquareValues.length; i++)
    {
        this.squareValues[i] = this.initialSquareValues[i];

        if (this.squareValues[i] != 0)
            this.valuableSquaresIndex.push(i);
    }

    // initialize neighbor squares array

    this.InitNeighbors();

    // set initial starting position

    this.board = new Array( 0x78 );

    for (i = 0; i < this.board.length; i++)
    if (this.OnBoard(i) == true)
        this.board[i] = EMPTY;
    else
        this.board[i] = INVALID;

    // piece totals

    this.blackTotal = this.whiteTotal = 0;

    // set initial disks

    this.SetBoardAt(3, 3, WHITE);

    this.SetBoardAt(4, 4, WHITE);

    this.SetBoardAt(3, 4, BLACK);

    this.SetBoardAt(4, 3, BLACK);

    // setup legal moves list

    this.legalMoves = new Array(MAX_DEPTH * MAX_MOVES);

    // seed all hash tables / values and set initial game hash

    this.SeedHashAndTT();

    // reset move history

    this.playedMoves = [];

    // setup history heuristic arrays

    this.history = new Array( 0x78 );

    for( i = 0 ; i < this.history.length ; i++)
        this.history[i] = 0;

    // setup pscores array, just a temporary accumulator for the positional score

    this.pscores = new Array(2);

    //this.PlaySequence( this.s4 );
}


//True if the index is on the board

ReversiEngine.prototype.OnBoard = function(index)
{
    return (index & 0x88) == 0;
}

//
// when to conclude the search
//
ReversiEngine.prototype.stopTime;

// seconds allocated to think about our move

ReversiEngine.prototype.thinkingTime = 2;

// history scores per square

ReversiEngine.prototype.history;

// true when time to abort the search

ReversiEngine.prototype.abort;

//
// nodes searched, k-nodes per second
//
ReversiEngine.prototype.nodes;

ReversiEngine.prototype.knodes;

//
// make a move for the current side to move using iterative deepening, the history heuristic
// and the transposition table
//
ReversiEngine.prototype.MakeMove = function() {

    // return debug information in a string

    var report = "";

    // the PV after finding a move

    var PV_TT;

    // gracefully age T.T. entries

    this.AgeTT();

    // start time for debugging

    var startTime = new Date();

    // reset nodes

    this.nodes = 0;

    // age history tables

    var i;

    for (i = 0; i < this.history.length; i++)
        this.history[i] /= 2;

    // setup stop time for thinking

    this.stopTime = new Date();

    // stop time is the start time ( MS ) + thinking time ( seconds ) * 1000 )

    this.stopTime.setTime( startTime.getTime() + this.thinkingTime * 1000 );

    // start iterative deepening at depth 1

    var maxDepth = 1;

    // reset abort flags, when true the search stops

    this.abort = false;

    var temp = this.gameHash;

    while (this.abort == false)
    {
        // execute search

        var x = this.NegaScout(0, maxDepth, -WIN, WIN, this.LastMovePass() );

        // ignore results if search aborted

        if (this.abort == false)
        {
            if (x > WIN_APPROXIMATION || x < -(WIN_APPROXIMATION))
            {
                report += "Forced Win Detected...search terminated";

                break;
            }
        }

        maxDepth += 1;
    }

    // construct PV from transposition table

    PV_TT = this.Find_PV_From_TT();

    var endTime = new Date();

    report += "\nNodes:" + this.nodes;

    this.knodes = Math.floor( this.nodes / this.thinkingTime / 1000 );

    report += "\nK-Nodes per seconds:" + this.knodes + "K";

    // add entire PV to report

    var pvs = "\n\nPV:\n";

    for( var j = 0 ; j < PV_TT.length ; j++ )
        pvs += this.BitPackMovedToString(PV_TT[j]) + "\n";

    report += pvs;

    // make best move if there was one

    this.PlayMove(PV_TT[0]);

    this.AddToHistory(PV_TT[0]);

    return report;

}

//
// return a plain text representation of a move
//
ReversiEngine.prototype.BitPackMovedToString = function(m)
{
    if (m == NULL_MOVE)
        return "Move PASS";

    var s = m & 1;

    m >>= 1;

    var col = m & 7;

    m >>= 3;

    var row = m & 7;

    return "Move " +  ( s == WHITE ? "W " : "B " ) + row + col;
}

//
// negascout move search with move sorting, history heuristic, transposition table
//
ReversiEngine.prototype.NegaScout = function(ply, maxDepth, alpha, beta, previousMoveWasNULL)
{
    // bump node count

    this.nodes++;

    // if we have reached the time limit set the abort flag and bail, score will not be used so any value can be returned

    if ( ( this.nodes & 0x0FFF ) == 0  )
    {
        var now = new Date();

        if ( now.getTime() > this.stopTime.getTime() ) {

            this.abort = true;

            return 0;
        }
    }


    // if search depth reached then return the static score.

    if (ply == maxDepth)
    {
        // get exact score for the position

        return this.NonTerminalScore(ply,previousMoveWasNULL);

    }

    // record alpha at start of procedure, this might be used later to update the TT

    var oldAlpha = alpha;

    // height of search tree is simple maxDepth - ply ( since ply always increases in this prograam )

    var height = maxDepth - ply;

    // retrieve TT entry for current position and side. Each entry is initialized to a depth of -1
    // that first test will always fail for unused entries

    var ttEntry = this.TT[this.side][this.gameHash % TT_SIZE];

    // depth must be an improvement AND the hash code must match

    var bestMove = NO_MOVE;

    if (ttEntry.key == this.gameHash)
    {
        // if the TT entry was search to at least the height of the current search then we can
        // use to get a score or set new bounds for a/b

        if (ttEntry.height >= height)
        {
            if (ttEntry.flags == TT_EXACT)
            {
                return ttEntry.score;
            }
            else
            if (ttEntry.flags == TT_LOWER)
                alpha = Math.max(alpha, ttEntry.score);
            else
            if (ttEntry.flags == TT_UPPER)
                beta = Math.min(beta, ttEntry.score);

        }

        // regardless of whether the TT is deeper result that present we can still seed the bestMove to get better move ordering

        bestMove = ttEntry.bestMove;

    }


    // generate legal moves

    var moves = this.GenerateLegalMoves(ply, previousMoveWasNULL);

    // if no moves this is terminal

    if (moves == 0)
    {
        // get terminal score

        return this.TerminalScore(ply);
    }


    // the TT code above might have set a/b so that a cutoff occurs, the following check handles that

    if (!(alpha >= beta))
    {
        // negascout initial window is (-β, -α)

        var b = beta;

        // try moves

        for (var i = 0; i < moves; i++)
        {
            // bring the best move to the top of the legal move list.

            this.SortMove(ply, moves, i, bestMove);

            // get bit packed move

            var m = this.legalMoves[ply * MAX_MOVES + i];

            // play moves

            this.PlayMove(m);

            // iterate deeper

            var search = -this.NegaScout(ply + 1, maxDepth, -b, -alpha, m == NULL_MOVE);

            // wider window required ?

            if (i > 0 && (alpha < search && search < beta))
            {
                search = -this.NegaScout(ply + 1, maxDepth, -beta, -alpha, m == NULL_MOVE);
            }


            // un-play move

            this.UnPlayMove(m);

            // if we are aborting return now

            if (this.abort == true)
                return 0;

            if (search > alpha)
            {
                // update best move

                bestMove = m;

                // this move caused a cutoff, so increase the history
                // value so it gets ordered high next time we can
                // search it.

                if (m != NULL_MOVE)
                    this.history[m & INDEX_MASK] += height << height;

                // update ab

                alpha = search;

                // alpha/beta pruning

                if (alpha >= beta)
                    break;

            }

            b = alpha + 1;
        }
    }
    // update the TT if the best move found improves the knowledge in the TT

    if (height >= ttEntry.height && bestMove != NO_MOVE )
    {
        if (alpha <= oldAlpha)
            ttEntry.flags = TT_UPPER;
        else
        if (alpha >= beta)
            ttEntry.flags = TT_LOWER;
        else
            ttEntry.flags = TT_EXACT;

        ttEntry.bestMove = bestMove;

        ttEntry.height = height;

        ttEntry.score = alpha;

        ttEntry.key = this.gameHash;
    }

    // return the score

    return alpha;
}


// Return the score for the side to move

ReversiEngine.prototype.NonTerminalScore = function(ply, previousMoveWasNULL)
{

    // score for both sides then subtract one from the other ( depending on side to play )

    // end of game ( this can occur at less that 64 pieces but that is handled below )

    if (this.whiteTotal + this.blackTotal == 64)
    {
        return this.TerminalScore(ply);
    }

    // get Leaf T.T.

    var he = this.LEAF_TT[this.side][this.gameHash % TT_SIZE];

    if ( he.key == this.gameHash )
        return he.score;

    // use mobility as score

    var blackMoves = this.CountLegalMovesForSide(BLACK, previousMoveWasNULL);

    var whiteMoves = this.CountLegalMovesForSide(WHITE, previousMoveWasNULL);

    // end of game ?

    if (whiteMoves + blackMoves == 0)
        return this.TerminalScore(ply);

    // also update the positional score

    this.pscores[WHITE] = this.pscores[BLACK] = 0;

    for (var i = 0; i < this.valuableSquaresIndex.length; i++)
    {
        var index = this.valuableSquaresIndex[i];

        this.pscores[this.board[index]] += this.squareValues[index];

    }

    // otherwise return the positional score

    var score = this.side == WHITE ? (whiteMoves + this.pscores[WHITE]) - (blackMoves + this.pscores[BLACK]) :

                                     (blackMoves + this.pscores[BLACK]) - (whiteMoves + this.pscores[WHITE]);

    // store in the leaf TT ( always overwrite entries )

    he.score = score;

    he.key = this.gameHash;

    // return score

    return score;
}

// so we don't have to allocate an array in the search loop.

ReversiEngine.prototype.pscores;


// Score for a terminal position. We add or subtract 'ply' to ensure the score is within the search window
// which begins at the root with -WIN,+WIN

ReversiEngine.prototype.TerminalScore = function(ply)
{
    var score = this.whiteTotal > this.blackTotal ? WIN - ply : (this.blackTotal > this.whiteTotal ? -WIN + ply : 0);

    if (this.side == WHITE)
        return score;

    return -score;
}


// Bring the highest scoring move in the history heuristic table to the top
// of the move list. If a move from the TT was supplied bring that to the top instead

ReversiEngine.prototype.SortMove = function(ply, moves, i, bestMove_TT)
{
    var BASE = MAX_MOVES * ply;

    var bestScore = -1;

    var bestIndex = -1;

    for (var j = i; j < moves; j++)
    {
        if ( this.legalMoves[BASE + j] == bestMove_TT )
        {
            bestIndex = j;

            break;
        }
        else
        if (this.history[this.legalMoves[BASE + j] & INDEX_MASK] > bestScore)
        {
            bestScore = this.history[this.legalMoves[BASE + j] & INDEX_MASK];

            bestIndex = j;
        }
    }

    // swap highest scoring move with move at current head of list

    if (bestIndex >= 0)
    {
        var temp = this.legalMoves[BASE + bestIndex];

        this.legalMoves[BASE + bestIndex] = this.legalMoves[BASE + i];

        this.legalMoves[BASE + i] = temp;
    }
}

ReversiEngine.prototype.PlaySequence = function(a) {

    for(var i = 0 ; i < a.length ; i++)
    {
        this.PlayUserMove( this.Row(a[i]), this.Col(a[i]) );
    }
}

//
// games for debugging
//

// a force win before the end of the game

ReversiEngine.prototype.s1 = [36,69,86,34,50,66,49,33,83,84,85,37,38,48,17,70,64,80,32,19,54,103,65,18,102,35,1,0,53,2,82,98,113,99,4,81,16,39,115,21,5,101,97,100,117,96,116,114,87,119,112,3,55,71,118,6,20,23];

// a draw with two moves to play

ReversiEngine.prototype.s2 = [83,50,33,82,84,99,53,101,66,35,36,16,98,69,37,38,22,6,34,81,32,20,96,54,39,113,5,21,100,80,118,3,4,23,97,114,85,55,112,18,2,86,71,7,17,116,19,103,115,70,117,102,87,1,49,64,65,48];

// problem finding terminal score

ReversiEngine.prototype.s3 = [66,82,98,97,96,114,99,112,65,64,37,116,100,69,83,80,53,21,48,50,70,85,35,71,86,20,101,103,87,117,119,102,19,84,55,3,22,113,118,32,33,36,115,54,39,7,4,18,23,34,2,49,38,17,16,1,0,6];

// PV with a PASS

ReversiEngine.prototype.s4 = [83,82,53,84,100,85,66,50,70,69,97,36,35,98,33,16,49,48,21,38,32,112,65,19,20,37,17,81,55,64,113,5,6,4,99,102,54,115,3,101,103,114,80,34,96,116,86,1,0,18,2,39,22,23,7];

// PV with double pass

ReversiEngine.prototype.s5 = [83,50,33,82,66,99,36,53,84,35,38,37,21,85,101,117,100,16,19,54,69,116,81,49,48,65,102,103,18,86,118,17,119,80,39,6,5,2,34,1,97,87,7,112,32,55,70,22,20,23,3,71,113,4,114];


//
// play a move from the user / ui supplied just as r/c. We must first
// generate the legal moves and they find the corresponding bit packed move which
// has the flipping information in it.
// To PASS, provide r and/or c < 0
// Returns true if the move is valid in the current position / side to move
//
ReversiEngine.prototype.PlayUserMove = function( r,c ) {

    // generate legal moves for side to move

    var moves = this.GenerateLegalMoves( 0, this.LastMovePass() );

    // get bit packed move for this location by scanning the legal move list

    var m = null;

    for( var j = 0 ; j < moves ; j++ ) {

        // check for a null move ( r or c < 0 )

        if ( ( r < 0 || c < 0 ) && this.legalMoves[j] == NULL_MOVE )
        {
            m = NULL_MOVE;

            break;
        }

        var move = this.legalMoves[ j ];

        move >>= 1;

        var col = move & 7;

        move >>= 3;

        var row = move & 7;

        if ( r == row && c == col)
        {
            m = this.legalMoves[j];

            break;
        }

    }

    // play the move if legal

    if ( m != null ) {

        // play it

        this.PlayMove(m);

        // add history

        this.AddToHistory(m);

        // move was legal

        return true;

    }

    // move was not legal

    return false;

}

/// <summary>
/// Play the bit packed moved. If the move is a null move it is still added to the history etc
/// </summary>
/// <param name="m"></param>
ReversiEngine.prototype.PlayMove = function(m)
{
    if (m != NULL_MOVE)
    {

        // get side, them col, then row from bit packed move

        var sidePlaying = m & 1;

        var sideNotPlaying = sidePlaying ^ 1;

        m >>= 1;

        var col = m & 7;

        m >>= 3;

        var row = m & 7;

        // create and index from row and columm and insert disk for played piece

        var index = row << 4 | col;

        this.board[index] = sidePlaying;

        // insert into hash value

        this.gameHash ^= this.hash_piece[sidePlaying][index];

        // update corner values

        this.UpdateCorners(index, true);

        // get track of total flips and pieces add to the board so we can update totals

        var totalFlipped = 0;

        // now extract and flip the disks in each direction. NOTE, we MUST go backwards through the directions since
        // they were inserted in the opposite direction

        for (var dir = 7; dir >= 0; dir--)
        {
            m >>= 3;

            var flipped = m & 7;

            totalFlipped += flipped;

            for (var f = 1; f <= flipped; f++)
            {
                // update piece itself

                var findex = index + this.offsets[dir] * f;

                this.board[findex] = sidePlaying;

                // remove old color from hash and insert new color

                this.gameHash ^= this.hash_piece[sideNotPlaying][findex];

                this.gameHash ^= this.hash_piece[sidePlaying][findex];
            }
        }

        // update totals

        if (sidePlaying == WHITE)
        {
            this.whiteTotal += 1 + totalFlipped;

            this.blackTotal -= totalFlipped;
        }
        else
        {
            this.blackTotal += 1 + totalFlipped;

            this.whiteTotal -= totalFlipped;
        }

        // update neighbors i.e for each adjacent square, increment its count of neighbors

        for(var i = 0 ;  i < this.neighborSquares[index].length ; i++ )
            this.ncount[ this.neighborSquares[index][i] ]++;
    }

    // switch sides

    this.side ^= 1;

    this.otherSide ^= 1;

}



/// <summary>
/// Un-Play the capture or non capture
/// </summary>
/// <param name="m"></param>
ReversiEngine.prototype.UnPlayMove = function(m)
{
    // update side hash

    if (m != NULL_MOVE)
    {
        // get other side, them col, then row from bit packed move

        var sidePlaying = m & 1;

        var sideNotPlaying = sidePlaying ^ 1;

        m >>= 1;

        var col = m & 7;

        m >>= 3;

        var row = m & 7;

        // create and index from row and columm and clear the square played into;

        var index = row << 4 | col;

        this.board[index] = EMPTY;

        // remove from hash as well

        this.gameHash ^= this.hash_piece[sidePlaying][index];

        // update corner values

        this.UpdateCorners(index, false);

        // get track of changes

        var totalFlipped = 0;

        // now extract and flip the disks in each direction. NOTE, we MUST go backwards through the directions since
        // they were inserted in the opposite direction

        for (var dir = 7; dir >= 0; dir--)
        {
            m >>= 3;

            var flipped = m & 7;

            totalFlipped += flipped;

            for (var f = 1; f <= flipped; f++)
            {
                // update piece itself

                var findex = index + this.offsets[dir] * f;

                this.board[findex] = sideNotPlaying;

                // remove old color from hash and insert new color

                this.gameHash ^= this.hash_piece[sidePlaying][findex];

                this.gameHash ^= this.hash_piece[sideNotPlaying][findex];
            }
        }

        // update totals

        if (sidePlaying == WHITE)
        {
            this.whiteTotal -= 1 + totalFlipped;

            this.blackTotal += totalFlipped;
        }
        else
        {
            this.blackTotal -= 1 + totalFlipped;

            this.whiteTotal += totalFlipped;
        }

        // update neighbors i.e for each adjacent square, decrement its count of neighbors

        for(var i = 0 ; i < this.neighborSquares[index].length ; i++ )
            this.ncount[ this.neighborSquares[index][i] ]--;
    }

    // switch sides

    this.side ^= 1;

    this.otherSide ^= 1;

    // return the un-played move

    return m;
}


/// <summary>
/// Transposition table, one for each side
/// </summary>
ReversiEngine.prototype.TT;

// terminal score transposition table, just for storing scores at leaf nodes

ReversiEngine.prototype.LEAF_TT;

/// Hash of current game position

ReversiEngine.prototype.gameHash;

/// <summary>
/// Initialize hash tables by calculating a random value for each piece ( WHITE/BLACK/SERF/KING ) on each square.
/// Create the transposition table as well.
/// </summary>
ReversiEngine.prototype.SeedHashAndTT = function()
{
    if (this.hash_piece == null)
    {
        // hash piece contains an entry for each color and each square ( and even impossible values )

        var hashLimit = WHITE | BLACK | EMPTY;

        this.hash_piece = Array(hashLimit + 1);

        var i, k,color;

        for( i = 0 ; i < this.hash_piece.length ; i++ )
        {
            this.hash_piece[i] = new Array( this.board.length );
        }

        for (i = 0; i <= hashLimit; ++i)
            for (k = 0; k <= 0x77; ++k)
                this.hash_piece[i][k] = this.Hash_Random();

        // create TT, initial each entry is assigned a depth of -1 which means empty

        this.TT = new Array(2);

        this.TT[0] = new Array(TT_SIZE);

        this.TT[1] = new Array(TT_SIZE);

        this.LEAF_TT = new Array(2);

        this.LEAF_TT[0] = new Array( TT_SIZE );

        this.LEAF_TT[1] = new Array( TT_SIZE );

        for (color = WHITE; color <= BLACK; color++)
        {
            for ( i = 0; i < TT_SIZE; i++)
            {
                this.TT[color][i] = new HashEntry();

                this.LEAF_TT[color][i] = new LeafHashEntry();
            }
        }
    }
    else
    {
        // just reset the TT table

        for (color = WHITE; color <= BLACK; color++)
            for (i = 0; i < TT_SIZE; i++)
            {
                this.TT[color][i].height = -1;

                this.LEAF_TT[color][i].key = 0;
            }


    }

    // set initial game hash

    this.gameHash = this.StaticHash();
}

/// <summary>
/// Lower the height of all used T.T. entries so that older entires gracefully age out eventually
/// </summary>
ReversiEngine.prototype.AgeTT = function()
{
    var c,i;

    for (c = WHITE; c <= BLACK; c++)
        for (i = 0; i < TT_SIZE; i++)

    if (this.TT[c][i].height > -1)
        this.TT[c][i].height--;
}

/// <summary>
/// Determine the PV from the TT.
/// </summary>
/// <returns></returns>
ReversiEngine.prototype.Find_PV_From_TT = function() {

    // build the list while playing the PV and harvesting the moves

    var PV = [];

    // mod the game hash with the size of the number

    var h = this.TT[this.side][ this.gameHash % TT_SIZE ];

    // we track the hash entries added to the PV. If we find a duplicate we terminate otherwise the program would end up in
    // an infinite loop

    var pvKeys = new Object();

    while (h != null && h.height >= 0 && h.key == this.gameHash )
    {
        // add key so we don't get into a infinite loop

        pvKeys[ h.key.toString() ] = h;

        // ensure move is legal ( T.T. type 2 errors are possible )

        this.GenerateLegalMoves(0, this.LastMovePass() );

        if ( this.IsLegalPVMove(h.bestMove) == false)
            break;

        PV.push(h.bestMove);

        this.PlayMove(h.bestMove);

        h = this.TT[this.side][ this.gameHash % TT_SIZE ];

        // if we have seen this key before or the hash table entry is used ( key == null ) bail before we get stuck

        if (h.key == null || pvKeys[h.key.toString()] != null)
            break;
    }

    // don't forget to un-play the PV!

    var i;

    for (i = PV.length - 1; i >= 0; i--)
        this.UnPlayMove(PV[i]);

    // return the PV

    return PV;
}

/// <summary>
/// True if the given move is present in the legal move list at ply zero. This is just used for validating the P.V.
/// </summary>
/// <param name="m"></param>
/// <returns></returns>
ReversiEngine.prototype.IsLegalPVMove = function(m)
{
    var count = this.GenerateLegalMoves(0, this.LastMovePass() );

    var i;

    for (i = 0; i < count; i++)
        if (this.legalMoves[i] == m)
            return true;

    return false;
}

/// <summary>
/// Calculate a complete hash value for the current board position
/// </summary>
/// <returns></returns>
ReversiEngine.prototype.StaticHash = function()
{
    var hash = 0;

    // XOR in hash value for each piece on each square

    var i;

    for (i = 0; i < 0x78; i++)
    {
        if ((i & 0x88) == 0 && this.board[i] != EMPTY)
        {
            hash ^= this.hash_piece[this.board[i]][i];
        }
    }

    return hash;
}

// hash values for each piece type on each square

ReversiEngine.prototype.hash_piece;


// Ideally ( and in the my original engine the Zobrist hash as a ulong i.e. unsigned 64 bit key ).
// Since Javascript does not have support for this type and using a library to fake the functionality
// performs badly ( i.e. google.Integer ) I have reduced the key size to 31 bit integers. Since
// JS converts the operands of bitwise operations to 32 bit signed numbers by using signed 31 bit numbers
// we should avoid performance issues and sign extension to negative territory.
// The down side is that now key collisions are much more common but since the engine performs at a fraction
// of the speed of a compiled language this hopefully won't have too much impact.

ReversiEngine.prototype.Hash_Random = function() {

    return this.rand();
}

// Should be identical to the crt function rand i.e. a random number 0->32767 inclusive

ReversiEngine.prototype.rand = function() {

    var limit = ( 1 << 31 ) >>> 0;

    return ( Math.random() * limit ) >>> 0;

}

/// <summary>
/// Return legal move list for the side to play. For UI use only. Too slow for in-engine use
/// </summary>
/// <returns></returns>
ReversiEngine.prototype.GetLegalMoveLocations = function(_side,_otherSide)
{
    var moves = [];

    for (var i = 0; i <= 0x77; i++)
    {
        if ((i & 0x88) == 0 && this.board[i] == EMPTY)
        {
            for (var dir = 0; dir < 8; dir++)
            {
                // first determine if the move is legal by probing in all directions

                if (this.Probe(i, dir, _side, _otherSide) > 0)
                {
                    // if move is legal then add the complete bit packed move to list

                    moves.push( { Row:this.Row(i), Column:this.Col(i) } );

                    break;
                }
            }
        }
    }

    return moves;
}

// Generate legal moves for the side to play. If on legal moves are found AND the previous moves was NOT a NULL_MOVE then a NULL_MOVE is generated

ReversiEngine.prototype.GenerateLegalMoves = function(ply, previousMoveWasPass) {

    var moves = 0;

    var baseIndex = MAX_MOVES * ply;

    var i, bits,dir;

    for ( i = 0; i <= 0x77; i++)
    {
        // to be considered index must be: Valid, Empty and have at least 1 neighbor

        if ((i & 0x88) == 0 && this.board[i] == EMPTY && this.ncount[i] > 0)
        {
            // create a bit-packed move for the location

            bits = 0;

            // insert flipped pieces for each direction

            for (dir = 0; dir < 8; dir++)
            {
                bits |= this.Probe(i, dir, this.side, this.otherSide);

                bits <<= 3;
            }

            // if any bits are set then this move flips at least 1 disk

            if (bits > 0)
            {
                // insert row then col into the least significant bits

                bits |= this.Row(i);

                bits <<= 3;

                bits |= this.Col(i);

                // finally insert side

                bits <<= 1;

                bits |= this.side;

                // insert into legal moves list

                this.legalMoves[baseIndex + moves] = bits;

                // bump count of moves

                moves++;
            }
        }
    }

    // if no moves generated and we are not the second NULL_MOVE in a row then add a NULL_MOVE
    // AND this isn't the end of the game

    if (moves == 0 && previousMoveWasPass == false )
    {
        this.legalMoves[baseIndex] = NULL_MOVE;

        moves++;
    }

    // return number of moves

    return moves;
}

// Just count the number of possible moves for the given side. Much faster than the full legal move generation

ReversiEngine.prototype.CountLegalMovesForSide = function(color,previousMoveWasPass) {

    var moves = 0;

    var otherColor = color ^ 1;

    var i;

    for (i = 0; i <= 0x77; i++)
    {
        // to be considered index must be: Valid, Empty and have at least 1 neighbor

        if ((i & 0x88) == 0 && this.board[i] == EMPTY && this.ncount[i] > 0)
        {
            // if we can flip pieces in any direction the move is legal

            if (this.Probe(i, 0, color, otherColor) > 0 ||
                this.Probe(i, 1, color, otherColor) > 0 ||
                this.Probe(i, 2, color, otherColor) > 0 ||
                this.Probe(i, 3, color, otherColor) > 0 ||
                this.Probe(i, 4, color, otherColor) > 0 ||
                this.Probe(i, 5, color, otherColor) > 0 ||
                this.Probe(i, 6, color, otherColor) > 0)
            {
                moves++;
            }
        }
    }

    // if no moves found and previous move wasn't a PASS a pass is allowed

    if (moves == 0 && previousMoveWasPass == false)
    {
        return 1;
    }

    // return number of moves

    return moves;
}

// Probe from the given index, in the given direction looking for an unbroken line of 'other' terminated by a 'side' piece
// If a match found return the number of pieces that would be flipped.
// Direction should be one of 0..7

ReversiEngine.prototype.Probe = function(i, direction, sideToMove, sideNotMoving)
{
    // count the number of pieces of side other starting from index and going in direction

    var count = 0;

    i += this.offsets[direction];

    while ( (i&0x88)== 0 && this.board[i] == sideNotMoving )
    {
        count++;

        i += this.offsets[direction];
    }

    // if no pieces of type 'other' then we are done

    if (count == 0)
        return 0;

    // if index is still on board and location contains side then return pieces flipped

    if ((i & 0x88) == 0 && this.board[i] == sideToMove)
        return count;

    return 0;
}


// Set color of piece at given location.
// for the lines etc

ReversiEngine.prototype.SetBoardAt = function(r, c, p)
{
    // set the main board

    var index = this.IndexFromRowColumn(r, c);

    if (this.board[index] == EMPTY && p == WHITE)
        this.whiteTotal++;

    if (this.board[index] == EMPTY && p == BLACK)
        this.blackTotal++;

    if (this.board[index] == WHITE && p == EMPTY)
        this.whiteTotal--;

    if (this.board[index] == BLACK && p == EMPTY)
        this.blackTotal--;

    this.board[index] = p;

    var i;

    if (p == WHITE || p == BLACK)
    {
        this.UpdateCorners(index, true);

        for( i = 0 ; i < this.neighborSquares[index].length ; i++)
            this.ncount[ this.neighborSquares[index][i] ]++;
    }
    else
    if (p == EMPTY)
    {
        this.UpdateCorners(index, false);

        for(i = 0 ; i < this.neighborSquares[index].length ; i++ )
            this.ncount[ this.neighborSquares[index][i] ]--;
    }
}


// Update the values of the corners according to index and whether we are adding or removing a piece

ReversiEngine.prototype.UpdateCorners = function(index, piecePlayed)
{
    if (piecePlayed == true)
    {
        // when adding a piece we zero out the score for the adjacent squares

        switch (index)
        {
            case NW_CORNER:
            {
                this.squareValues[NW_C1] = this.squareValues[NW_C2] = this.squareValues[NW_X] = 0;

            } break;

            case NE_CORNER:
            {
                this.squareValues[NE_C1] = this.squareValues[NE_C2] = this.squareValues[NE_X] = 0;

            } break;

            case SW_CORNER:
            {
                this.squareValues[SW_C1] = this.squareValues[SW_C2] = this.squareValues[SW_X] = 0;

            } break;

            case SE_CORNER:
            {
                this.squareValues[SE_C1] = this.squareValues[SE_C2] = this.squareValues[SE_X] = 0;

            } break;
        }
    }
    else
    {
        // when removing a piece from the corner we reset the score for the adjacent squares

        switch (index)
        {

            case NW_CORNER:
            {
                this.squareValues[NW_C1] = this.squareValues[NW_C2] = this.initialSquareValues[NW_C1];

                this.squareValues[NW_X] = this.initialSquareValues[NW_X];

            } break;

            case NE_CORNER:
            {
                this.squareValues[NE_C1] = this.squareValues[NE_C2] = this.initialSquareValues[NE_C1];

                this.squareValues[NE_X] = this.initialSquareValues[NE_X];

            } break;

            case SW_CORNER:
            {
                this.squareValues[SW_C1] = this.squareValues[SW_C2] = this.initialSquareValues[SW_C1];

                this.squareValues[SW_X] = this.initialSquareValues[SW_X];

            } break;

            case SE_CORNER:
            {
                this.squareValues[SE_C1] = this.squareValues[SE_C2] = this.initialSquareValues[SE_C1];

                this.squareValues[SE_X] = this.initialSquareValues[SE_X];

            } break;
        }
    }
}

// the board array

ReversiEngine.prototype.board;

// convert our 0x88 board to a flat array

ReversiEngine.prototype.FlatBoard = function() {

    var a = [];

    for( var i = 0 ; i < this.board.length ; i++)
        if ( ( i & 0x88 ) == 0 )
            a.push( this.board[i]);

    return a;
}

// total of pieces of each color currently on the board

ReversiEngine.prototype.blackTotal;

ReversiEngine.prototype.whiteTotal;


//
// for each valid square create a list of the indexes of its neighbors.
// Also create an array that it incremented and decremented whenever a piece is removed from a neighboring square.
// These data structures are used to speed up legal move creation
//
ReversiEngine.prototype.InitNeighbors = function() {

    this.neighborSquares = new Array( 0x78 );

    var i, dir,n;

    for (i = 0; i <= 0x77; i++)
    {
        if ((i & 0x88) == 0)
        {
            // first count neighbors so we can size the array correctly

            this.neighborSquares[i] = [];

            count = 0;

            for ( dir = 0; dir < 8; dir++)
            {
                n = i + this.offsets[dir];

                if ((n & 0x88) == 0)
                    this.neighborSquares[i].push(n);
            }
        }
    }

    this.ncount = new Array(0x78);

    for (i = 0; i < this.ncount.length; i++)
        this.ncount[i] = 0;
}

// Return true if the previous move played was a pass

ReversiEngine.prototype.LastMovePass = function() {

    if (this.playedMoves.length == 0)
        return false;

    return this.PeekHistory() == NULL_MOVE;
}

// return an object with .Row .Column set to the last played move. Return null if last move
// was a pass

ReversiEngine.prototype.LastMove = function() {

    if ( this.playedMoves == null || this.playedMoves.length == 0 || this.LastMovePass() == true)
        return null;

    var m = this.playedMoves[this.playedMoves.length-1];

    m >>= 1;

    var col = m & 7;

    m >>= 3;

    var row = m & 7;

    return { Row:row,Column:col };
}

// Move index from bit packed move

ReversiEngine.prototype.MoveIndex = function(m)
{
    m >>= 1;

    var col = m & 7;

    m >>= 3;

    var row = m & 7;

    return row << 4 | col;
}

    /// <summary>
    /// Indicate the state of the game
    /// </summary>
    /// <returns></returns>
ReversiEngine.prototype.EngineState = function()
{
    if (this.whiteTotal + this.blackTotal == 64)
    {
        if (this.whiteTotal > this.blackTotal)
            return WHITE_WIN;

        if (this.blackTotal > this.whiteTotal)
            return BLACK_WIN;

        return DRAW;
    }

    // get count of moves for both sides

    var whiteMoves = this.GetLegalMoveLocations(WHITE,BLACK).length; // this.CountLegalMovesForSide(WHITE, this.LastMovePass() );

    var blackMoves = this.GetLegalMoveLocations(BLACK,WHITE).length; // this.CountLegalMovesForSide(BLACK, this.LastMovePass() );

    if (whiteMoves == 0 && blackMoves == 0)
    {

        if (this.whiteTotal > this.blackTotal)
            return WHITE_WIN;

        if (this.blackTotal > this.whiteTotal)
            return BLACK_WIN;

        return DRAW;
    }

    // check for pass

    if (this.side == WHITE && whiteMoves == 0)
        return WHITE_PASS;

    if (this.side == BLACK && blackMoves == 0)
        return BLACK_PASS;

    // return the side to move

    return this.side == BLACK ? BLACK_MOVE : WHITE_MOVE;

}


// Row from $88 index
ReversiEngine.prototype.Row = function(index)
{
    return (index & 0x70) >> 4;
}

// Col from $88 index
ReversiEngine.prototype.Col = function(index)
{
    return index & 0x7;
}

 // Board index from a row and column

ReversiEngine.prototype.IndexFromRowColumn = function( r, c)
{
    return (r << 4) | c;
}

// Index from a bit packed move

ReversiEngine.prototype.IndexFromMove = function(m)
{
    m >>= 1;

    var col = m & 7;

    m >>= 3;

    var row = m & 7;

    var index = row << 4 | col;

    return index;
}

//
// history of played moves
//
ReversiEngine.prototype.playedMoves;

ReversiEngine.prototype.AddToHistory = function(m) {

    this.playedMoves.push(m);
}

ReversiEngine.prototype.PeekHistory = function()
{
    return this.playedMoves[ this.playedMoves.Count-1 ];
}

//
// take back the most recent move
//
ReversiEngine.prototype.TakeBack = function() {

    if (this.playedMoves.length > 0)
    {
        var m = this.playedMoves.pop();

        this.UnPlayMove(m);
    }
}


// Offsets required to move in a given direction on the 0x88 board. Starts with N and goes clockwise i.e. N,NE,E,SE,S,SW,W,NW
// A complete move is stored in a single int by storing the number of pieces flipped in all 8 directions. The count of
// pieces flipped requires 3 bits ( a maximum of 6 disks can be flipped in any direction ). The index into the board requires 6 bits ( 3 for row and 3 for column ).
// Therefore the required bits is 8*3+6 = 30
// When a move is stored in a int they are stored in this order:
// MSB Disks flipped for N,NE,E,SE,S,SW,W,NE then R, then C, then 1 bit for side ( LIGHT or DARK )
//

ReversiEngine.prototype.offsets = [-16, -15, 1, 17, 16, 15, -1, -17 ];

// number of neighbors for each square

ReversiEngine.prototype.ncount;

/// <summary>
/// For each square on the board, this is the number of neighbors of this square and the indexes of those squares
/// </summary>
ReversiEngine.prototype.neighborSquares;

// starting values of squares. During a game the array squareValues contains the actual values
// which are tweaked as moves are played

ReversiEngine.prototype.initialSquareValues = [

    4000,-800, 100,   0,   0, 100,-800,4000,                0,0,0,0,0,0,0,0,
    -800,-900,   0,   0,   0,   0,-900,-800,                0,0,0,0,0,0,0,0,
     100,   0,   0,   0,   0,   0,   0, 100,                0,0,0,0,0,0,0,0,
       0,   0,   0,   0,   0,   0,   0,   0,                0,0,0,0,0,0,0,0,
       0,   0,   0,   0,   0,   0,   0,   0,                0,0,0,0,0,0,0,0,
     100,   0,   0,   0,   0,   0,   0, 100,                0,0,0,0,0,0,0,0,
    -800,-900,   0,   0,   0,   0,-900,-800,                0,0,0,0,0,0,0,0,
    4000,-800, 100,   0,   0, 100,-800,4000,                0,0,0,0,0,0,0,0,

];

// the dynamically adjusted square values

ReversiEngine.prototype.squareValues;

// index of positionally interesting squares

ReversiEngine.prototype.valuableSquaresIndex;