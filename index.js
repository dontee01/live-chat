var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var mysql = require('mysql');
// var connection = mysql.createConnection({
//   host     : 'bbnlab.tech',
//   user     : 'bbnlab_john',
//   password : 'greatnesS01',
//   database: 'bbnlab_inboxplus'
// });

// connection.connect();

function initializeConnection(config) {
    function addDisconnectHandler(connection) {
        connection.on("error", function (error) {
            if (error instanceof Error) {
                if (error.code === "PROTOCOL_CONNECTION_LOST") {
                    console.error(error.stack);
                    console.log("Lost connection. Reconnecting...");

                    initializeConnection(connection.config);
                } else if (error.fatal) {
                    throw error;
                }
            }
        });
    }

    var connection = mysql.createConnection(config);

    // Add handlers.
    addDisconnectHandler(connection);

    connection.connect();
    return connection;
}



// var connection = initializeConnection({
//   host     : 'bbnlab.tech',
//   user     : 'bbnlab_john',
//   password : 'greatnesS01',
//   database: 'bbnlab_inboxplus'
// });


var connection = initializeConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database: 'contacts'
});



// Routing
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.sendfile('index.html');
});


// Chatroom
// function formatDate(date) {
//   var hours = date.getHours();
//   var minutes = date.getMinutes();
//   var ampm = hours >= 12 ? 'pm' : 'am';
//   hours = hours % 12;
//   hours = hours ? hours : 12; // the hour '0' should be '12'
//   minutes = minutes < 10 ? '0'+minutes : minutes;
//   var strTime = hours + ':' + minutes + ' ' + ampm;
//   return date.getFullYear() + "-" + date.getMonth()+1 + "-" + date.getDate() + "  " + strTime;
// }

function date_format(date) {
    var year = date.getFullYear(),
        month = date.getMonth() + 1, // months are zero indexed
        day = date.getDate(),
        hour = date.getHours(),
        minute = date.getMinutes(),
        second = date.getSeconds(),
        hourFormatted = hour % 12 || 12, // hour returned in 24 hour format
        minuteFormatted = minute < 10 ? "0" + minute : minute,
        morning = hour < 12 ? "am" : "pm";

    return year + "-" + month + "-" + day + " " + hourFormatted + ":" +
            minuteFormatted + ":" + second;
}

Number.prototype.padLeft = function(base,chr){
   var  len = (String(base || 10).length - String(this).length)+1;
   return len > 0? new Array(len).join(chr || '0')+this : this;
}
function formatDate(d)
{
// var d = new Date,
        dformat = [ d.getFullYear(),
        			(d.getMonth()+1).padLeft(),
                    d.getDate().padLeft(),
                    ].join('-')+
                    ' ' +
                  [ d.getHours().padLeft(),
                    d.getMinutes().padLeft(),
                    d.getSeconds().padLeft()].join(':');
	return dformat;
}


var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    console.log('Socket User Id: ', socket.username);

    // user_id = 0;
	connection.query('SELECT id from users where mobile = ?', socket.username, function(err, rows, fields) {
	  if (err) throw err;
	  console.log('User Id: ', JSON.stringify(rows[0].id)+'Rows '+JSON.stringify(fields)+' Fields');
	  user_id = rows[0].id;

	  // var time_cur = Date.parse('YYYY-MM-DD hh:mm:ss');
	  var date_inst = new Date();
	  time_cur = formatDate(date_inst);
	    var values = {sender_id: user_id, messages: data, created: time_cur};
	    connection.query('INSERT INTO messages SET ?', values, function(err, result) {
		  if (err) throw err;

		  console.log('Values ', values);

		  console.log('Insert Result: ', result);
		});

	});


    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

	connection.query('SELECT user_statuses_id AS status from users where mobile = ?', username, function(err, rows, fields) {
	  if (err) throw err;
	  // console.log('The result: ', rows);
	  if (rows.length < 1)
	  {
	    socket.emit('login', {
	      logged: 0
	    });
	    // socket.disconnect();
	    // return;

	  console.log('Failed: ', rows);
	  }
	  else
	  {
	  	socket.username = username;
	    ++numUsers;
	    addedUser = true;

	    socket.emit('login', {
	      logged: 1,
	      numUsers: numUsers
	    });

	    socket.broadcast.emit('User joined', {
	      username: socket.username,
	      numUsers: numUsers
	    });
	  console.log('Success: ', rows);

	  }
	// connection.end();
	});


    // we store the username in the socket session for this client
    // socket.username = username;
    // ++numUsers;
    // addedUser = true;
    // socket.emit('login', {
    //   numUsers: numUsers
    // });
    // // echo globally (all clients) that a person has connected
    // socket.broadcast.emit('user joined', {
    //   username: socket.username,
    //   numUsers: numUsers
    // });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});